from uuid import UUID, uuid4

from fastapi import Request, Response

SESSION_COOKIE = "gospel_rag_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 365  # 1 year


async def get_session_id(request: Request, response: Response) -> UUID:
    """
    FastAPI dependency that reads (or creates) an anonymous session cookie.
    The UUID is used as the tenant key for all conversations.
    """
    raw = request.cookies.get(SESSION_COOKIE)
    if raw:
        try:
            return UUID(raw)
        except ValueError:
            pass  # invalid cookie → issue a fresh one

    new_id = uuid4()
    response.set_cookie(
        key=SESSION_COOKIE,
        value=str(new_id),
        httponly=True,
        samesite="lax",
        secure=False,   # set to True in production behind HTTPS
        max_age=SESSION_MAX_AGE,
        path="/",
    )
    return new_id
