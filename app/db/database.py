from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def build_engine(url: str | None = None):
    settings = get_settings()
    db_url = url or settings.database_url
    return create_async_engine(
        db_url,
        echo=not settings.is_production,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
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
