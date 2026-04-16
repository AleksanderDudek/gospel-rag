"""Integration tests for the /conversations/* endpoints."""

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_conversation(client: AsyncClient, session_cookie: str):
    resp = await client.post(
        "/conversations",
        cookies={"gospel_rag_session": session_cookie},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["title"] == "New chat"
    return data["id"]


@pytest.mark.asyncio
async def test_list_conversations(client: AsyncClient, session_cookie: str):
    # Create two conversations
    for _ in range(2):
        await client.post("/conversations", cookies={"gospel_rag_session": session_cookie})

    resp = await client.get(
        "/conversations",
        cookies={"gospel_rag_session": session_cookie},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_get_conversation_with_messages(client: AsyncClient, session_cookie: str):
    create_resp = await client.post(
        "/conversations",
        cookies={"gospel_rag_session": session_cookie},
    )
    conv_id = create_resp.json()["id"]

    resp = await client.get(
        f"/conversations/{conv_id}",
        cookies={"gospel_rag_session": session_cookie},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == conv_id
    assert "messages" in data
    assert isinstance(data["messages"], list)


@pytest.mark.asyncio
async def test_rename_conversation(client: AsyncClient, session_cookie: str):
    create_resp = await client.post(
        "/conversations",
        cookies={"gospel_rag_session": session_cookie},
    )
    conv_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/conversations/{conv_id}",
        json={"title": "My renamed conversation"},
        cookies={"gospel_rag_session": session_cookie},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "My renamed conversation"


@pytest.mark.asyncio
async def test_delete_conversation(client: AsyncClient, session_cookie: str):
    create_resp = await client.post(
        "/conversations",
        cookies={"gospel_rag_session": session_cookie},
    )
    conv_id = create_resp.json()["id"]

    del_resp = await client.delete(
        f"/conversations/{conv_id}",
        cookies={"gospel_rag_session": session_cookie},
    )
    assert del_resp.status_code == 204

    # Should 404 after deletion
    get_resp = await client.get(
        f"/conversations/{conv_id}",
        cookies={"gospel_rag_session": session_cookie},
    )
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_cross_session_access_is_forbidden(client: AsyncClient):
    """A conversation created by session A must not be visible to session B."""
    session_a = str(uuid.uuid4())
    session_b = str(uuid.uuid4())

    create_resp = await client.post(
        "/conversations",
        cookies={"gospel_rag_session": session_a},
    )
    conv_id = create_resp.json()["id"]

    resp = await client.get(
        f"/conversations/{conv_id}",
        cookies={"gospel_rag_session": session_b},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cascade_delete_removes_messages(client: AsyncClient, session_cookie: str):
    """Deleting a conversation cascades to its messages."""
    create_resp = await client.post(
        "/conversations",
        cookies={"gospel_rag_session": session_cookie},
    )
    conv_id = create_resp.json()["id"]

    # Manually insert a message via the DB to verify cascade
    # (avoiding a real Claude API call in tests)
    import uuid as _uuid

    from sqlalchemy import text

    from app.db.database import AsyncSessionLocal
    from app.db.models import Message

    async with AsyncSessionLocal() as db:
        msg = Message(
            id=_uuid.uuid4(),
            conversation_id=_uuid.UUID(conv_id),
            role="user",
            content="test",
            kind="text",
        )
        db.add(msg)
        await db.commit()
        msg_id = str(msg.id)

    # Delete the conversation
    await client.delete(
        f"/conversations/{conv_id}",
        cookies={"gospel_rag_session": session_cookie},
    )

    # Confirm message is gone
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("SELECT id FROM messages WHERE id = :id"),
            {"id": _uuid.UUID(msg_id)},
        )
        assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_new_session_gets_cookie(client: AsyncClient):
    """A request with no session cookie should receive one in the response."""
    resp = await client.post("/conversations")
    assert "gospel_rag_session" in resp.cookies or "set-cookie" in resp.headers
