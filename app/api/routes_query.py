"""
POST /query — streaming RAG query against the Gospels.

Used directly by external clients or via the conversation endpoint.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.rag.generation import stream_rag_response
from app.rag.retrieval import hybrid_search

router = APIRouter(prefix="/query", tags=["query"])


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    translation_ids: list[str] | None = Field(
        default=None,
        description="Filter to specific translations, e.g. ['KJV', 'WEB']. None = all.",
    )
    books: list[str] | None = Field(
        default=None,
        description="Filter to specific books, e.g. ['MAT', 'JHN']. None = all four Gospels.",
    )
    conversation_history: list[dict] | None = Field(
        default=None,
        description="Prior messages for multi-turn context: [{role, content}]",
    )


@router.post("")
async def query(
    body: QueryRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Stream a grounded RAG answer in Vercel AI SDK data stream format.

    Response headers:
        Content-Type: text/plain; charset=utf-8
        x-vercel-ai-data-stream: v1
    """
    context_verses = await hybrid_search(
        db,
        query=body.query,
        translation_ids=body.translation_ids,
        books=body.books,
    )

    return StreamingResponse(
        stream_rag_response(
            query=body.query,
            context_verses=context_verses,
            conversation_history=body.conversation_history,
        ),
        media_type="text/plain; charset=utf-8",
        headers={
            "x-vercel-ai-data-stream": "v1",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
