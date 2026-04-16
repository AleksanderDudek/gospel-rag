from collections.abc import AsyncGenerator
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def _prepare_url(raw_url: str) -> tuple[str, dict]:
    """Strip libpq-only params (sslmode) from the URL and return asyncpg connect_args."""
    parsed = urlparse(raw_url)
    params = parse_qs(parsed.query, keep_blank_values=True)

    ssl_mode = params.pop("sslmode", [None])[0]
    connect_args: dict = {}
    if ssl_mode in ("require", "verify-ca", "verify-full"):
        connect_args["ssl"] = True

    new_query = urlencode({k: v[0] for k, v in params.items()})
    clean_url = urlunparse(parsed._replace(query=new_query))
    return clean_url, connect_args


def build_engine(url: str | None = None):
    settings = get_settings()
    db_url, connect_args = _prepare_url(url or settings.database_url)
    return create_async_engine(
        db_url,
        echo=not settings.is_production,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


engine = build_engine()

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
