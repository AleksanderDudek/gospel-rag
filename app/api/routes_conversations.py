"""
/conversations/* — CRUD + streaming message endpoint.
All routes require the session cookie (anonymous auth).
"""

import json
import re
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.routes_compare import CompareRequest, compare
from app.api.routes_passage import PassageRequest, passage
from app.auth.session import get_session_id
from app.config import get_settings as _get_settings
from app.db.database import get_db
from app.db.models import Conversation, Message
from app.rag.generation import _estimate_cost, generate_title, stream_rag_response
from app.rag.retrieval import hybrid_search

router = APIRouter(prefix="/conversations", tags=["conversations"])

# ── Slash command detection ───────────────────────────────────────────────────
_DATE_TITLE_RE = re.compile(r"^\d{8} \d{2}:\d{2}$")  # matches DDMMYYYY HH:MM default titles

_COMPARE_RE = re.compile(
    r"^/compare\s+([A-Z]{3}\s+\d+:\d+(?:-\d+)?)\s+((?:[A-Z]+\s*)+)$", re.IGNORECASE
)
_PASSAGE_RE = re.compile(r"^/passage\s+([A-Z]{3}\s+\d+:\d+(?:-\d+)?)(.*)$", re.IGNORECASE)


def _detect_slash(content: str) -> tuple[str, dict] | None:
    """Return (kind, kwargs) if content is a slash command, else None."""
    stripped = content.strip()

    m = _COMPARE_RE.match(stripped)
    if m:
        ref = m.group(1).strip().upper()
        translations = [t.upper() for t in m.group(2).split() if t.strip()]
        return "compare", {"reference": ref, "translation_ids": translations}

    m = _PASSAGE_RE.match(stripped)
    if m:
        ref = m.group(1).strip().upper()
        flags = m.group(2).lower()
        return "passage", {
            "reference": ref,
            "include_parallels": "--parallels" in flags,
            "synthesize": "--synthesize" in flags,
        }

    return None


# ── Schemas ──────────────────────────────────────────────────────────────────


class ConversationOut(BaseModel):
    id: UUID
    title: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    kind: str
    payload_json: dict | list | None
    citations_json: list | None
    cost_usd: float | None
    input_tokens: int | None
    output_tokens: int | None
    created_at: str

    model_config = {"from_attributes": True}


class ConversationWithMessages(ConversationOut):
    messages: list[MessageOut]


class SendMessageRequest(BaseModel):
    # useChat sends {messages: [...]} — we take the last user message
    messages: list[dict] = Field(..., min_length=1)


class RenameRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _conv_out(conv: Conversation) -> dict:
    return {
        "id": str(conv.id),
        "title": conv.title,
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
    }


def _msg_out(msg: Message) -> dict:
    return {
        "id": str(msg.id),
        "role": msg.role,
        "content": msg.content,
        "kind": msg.kind,
        "payload_json": msg.payload_json,
        "citations_json": msg.citations_json,
        "cost_usd": msg.cost_usd,
        "input_tokens": msg.input_tokens,
        "output_tokens": msg.output_tokens,
        "created_at": msg.created_at.isoformat(),
    }


async def _assert_owned(
    db: AsyncSession,
    conv_id: UUID,
    session_id: UUID,
) -> Conversation:
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.session_id == session_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return conv


# ── Routes ───────────────────────────────────────────────────────────────────


@router.post("", status_code=201)
async def create_conversation(
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db),
    session_id: UUID = Depends(get_session_id),
) -> dict:
    title = datetime.now(UTC).strftime("%d%m%Y %H:%M")
    conv = Conversation(session_id=session_id, title=title)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return _conv_out(conv)


@router.get("")
async def list_conversations(
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db),
    session_id: UUID = Depends(get_session_id),
    offset: int = 0,
    limit: int = 50,
) -> list[dict]:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.session_id == session_id)
        .order_by(Conversation.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    convs = result.scalars().all()
    return [_conv_out(c) for c in convs]


@router.get("/{conv_id}")
async def get_conversation(
    conv_id: UUID,
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db),
    session_id: UUID = Depends(get_session_id),
) -> dict:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv_id, Conversation.session_id == session_id)
        .options(selectinload(Conversation.messages))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    out = _conv_out(conv)
    out["messages"] = [_msg_out(m) for m in conv.messages]
    return out


@router.patch("/{conv_id}")
async def rename_conversation(
    conv_id: UUID,
    body: RenameRequest,
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db),
    session_id: UUID = Depends(get_session_id),
) -> dict:
    conv = await _assert_owned(db, conv_id, session_id)
    conv.title = body.title
    await db.commit()
    await db.refresh(conv)
    return _conv_out(conv)


@router.delete("/{conv_id}", status_code=204)
async def delete_conversation(
    conv_id: UUID,
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db),
    session_id: UUID = Depends(get_session_id),
) -> None:
    conv = await _assert_owned(db, conv_id, session_id)
    await db.delete(conv)
    await db.commit()


@router.post("/{conv_id}/messages")
async def send_message(
    conv_id: UUID,
    body: SendMessageRequest,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    session_id: UUID = Depends(get_session_id),
) -> Response:
    """
    Receive the latest user message, stream an assistant reply, and persist both.
    Detects /compare and /passage slash commands and routes them accordingly.
    """
    # Verify ownership
    conv = await _assert_owned(db, conv_id, session_id)

    # The Vercel AI SDK useChat sends all messages; last one is the new user message
    last = body.messages[-1]
    if last.get("role") != "user":
        raise HTTPException(400, "Last message must be from the user")
    user_content: str = last.get("content", "")

    # Persist user message
    user_msg = Message(
        conversation_id=conv_id,
        role="user",
        content=user_content,
        kind="text",
    )
    db.add(user_msg)
    await db.commit()

    # Auto-title after first user message (background task)
    msg_count_result = await db.execute(select(Message).where(Message.conversation_id == conv_id))
    if len(msg_count_result.scalars().all()) <= 1 and _DATE_TITLE_RE.match(conv.title):
        background_tasks.add_task(_auto_title, conv_id, user_content)

    # ── Slash command routing ────────────────────────────────────────────────
    slash = _detect_slash(user_content)

    if slash:
        kind, kwargs = slash
        return await _handle_slash(db, conv_id, kind, kwargs, request)

    # ── Regular RAG streaming ────────────────────────────────────────────────
    # Build conversation history for Claude (last 10 turns max)
    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id, Message.kind == "text")
        .order_by(Message.created_at.desc())
        .limit(21)  # 10 pairs + the new message we just added
    )
    history_msgs = list(reversed(history_result.scalars().all()))
    # Exclude the message we just inserted (last one) for the history
    prior = history_msgs[:-1]
    history = [{"role": m.role, "content": m.content} for m in prior]

    # Retrieve relevant verses
    context_verses = await hybrid_search(db, query=user_content)

    async def _stream_and_persist():
        full_text = ""
        input_tokens = 0
        output_tokens = 0
        citations_data = []

        async for line in stream_rag_response(user_content, context_verses, history):
            if line.startswith("2:"):
                # Parse the data event to extract citations + tokens
                try:
                    data_list = json.loads(line[2:])
                    if data_list:
                        d = data_list[0]
                        citations_data = d.get("citations", [])
                        input_tokens = d.get("input_tokens", 0)
                        output_tokens = d.get("output_tokens", 0)
                        full_text = d.get("full_text", full_text)
                except (json.JSONDecodeError, IndexError, KeyError):
                    pass
            yield line

        # Persist assistant message after streaming
        cost = _estimate_cost(
            _get_settings().generation_model,
            input_tokens,
            output_tokens,
        )
        asst_msg = Message(
            conversation_id=conv_id,
            role="assistant",
            content=full_text,
            kind="text",
            citations_json=citations_data,
            cost_usd=cost,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
        # New DB session for background persist (current session may be closed)
        from app.db.database import AsyncSessionLocal

        async with AsyncSessionLocal() as persist_db:
            persist_db.add(asst_msg)
            # Touch conversation.updated_at
            await persist_db.execute(
                update(Conversation)
                .where(Conversation.id == conv_id)
                .values(updated_at=datetime.now(UTC))
            )
            await persist_db.commit()

    return StreamingResponse(
        _stream_and_persist(),
        media_type="text/plain; charset=utf-8",
        headers={
            "x-vercel-ai-data-stream": "v1",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _handle_slash(
    db: AsyncSession,
    conv_id: UUID,
    kind: str,
    kwargs: dict,
    request: Request,
) -> Response:
    """Handle /compare or /passage commands — returns a non-streaming JSON-wrapped SSE."""
    payload = None
    content_summary = ""

    if kind == "compare":
        try:
            result = await compare(CompareRequest(**kwargs), db)
            payload = result.model_dump()
            ref = kwargs.get("reference", "")
            trans = ", ".join(kwargs.get("translation_ids", []))
            content_summary = f"Comparison of {ref} across {trans}"
        except HTTPException as e:
            payload = {"error": e.detail}
            content_summary = f"Error: {e.detail}"

    elif kind == "passage":
        try:
            result = await passage(PassageRequest(**kwargs), db)
            payload = result.model_dump()
            content_summary = f"Passage: {kwargs.get('reference', '')}"
        except HTTPException as e:
            payload = {"error": e.detail}
            content_summary = f"Error: {e.detail}"

    # Persist assistant message
    asst_msg = Message(
        conversation_id=conv_id,
        role="assistant",
        content=content_summary,
        kind=kind,
        payload_json=payload,
    )
    db.add(asst_msg)
    await db.commit()

    # Emit as a single SSE "data" event (frontend renders it as a panel)
    from app.rag.generation import _data_event, _finish_event

    async def _single_event():
        yield _data_event([{"kind": kind, "payload": payload}])
        yield _finish_event("stop", 0, 0)

    return StreamingResponse(
        _single_event(),
        media_type="text/plain; charset=utf-8",
        headers={
            "x-vercel-ai-data-stream": "v1",
            "Cache-Control": "no-cache",
        },
    )


async def _auto_title(conv_id: UUID, first_message: str) -> None:
    """Background task: generate and save a conversation title."""
    try:
        title = await generate_title(first_message)
        from app.db.database import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Conversation).where(Conversation.id == conv_id).values(title=title)
            )
            await db.commit()
    except Exception:
        pass  # Don't crash the main request if titling fails
