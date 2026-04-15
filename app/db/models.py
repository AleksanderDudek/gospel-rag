from datetime import datetime
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import get_settings
from app.db.database import Base


def _dims() -> int:
    return get_settings().embedding_dimensions


# ── Gospel translations ───────────────────────────────────────────────────────

GOSPEL_BOOKS = {"MAT": "Matthew", "MRK": "Mark", "LUK": "Luke", "JHN": "John"}


class Translation(Base):
    """A Bible translation (e.g. KJV, WEB, ASV, YLT)."""

    __tablename__ = "translations"

    id: Mapped[str] = mapped_column(String(10), primary_key=True)  # e.g. "KJV"
    name: Mapped[str] = mapped_column(String(100))
    language: Mapped[str] = mapped_column(String(10), default="en")
    license: Mapped[str] = mapped_column(String(200), default="Public Domain")

    verses: Mapped[list["Verse"]] = relationship(back_populates="translation_obj")


class Verse(Base):
    """A single Bible verse, with embedding and FTS vector."""

    __tablename__ = "verses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    translation_id: Mapped[str] = mapped_column(
        String(10), ForeignKey("translations.id", ondelete="CASCADE"), index=True
    )
    book: Mapped[str] = mapped_column(String(5))   # MAT, MRK, LUK, JHN
    chapter: Mapped[int] = mapped_column(Integer)
    verse: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)

    # Full-text search (populated by DB trigger / loader)
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR, nullable=True)

    # Semantic search
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(_dims()), nullable=True
    )

    translation_obj: Mapped[Translation] = relationship(back_populates="verses")

    __table_args__ = (
        Index("ix_verses_book_chapter_verse", "book", "chapter", "verse"),
        Index("ix_verses_translation_book", "translation_id", "book"),
        Index("ix_verses_search_vector", "search_vector", postgresql_using="gin"),
        # HNSW vector index (created after data load via migration)
    )

    @property
    def reference(self) -> str:
        return f"{self.book} {self.chapter}:{self.verse}"

    @property
    def citation(self) -> str:
        return f"[{self.book} {self.chapter}:{self.verse}, {self.translation_id}]"


# ── Conversation / session ────────────────────────────────────────────────────

class Conversation(Base):
    """An anonymous chat session (identified by cookie UUID)."""

    __tablename__ = "conversations"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    title: Mapped[str] = mapped_column(String(200), default="New chat")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    __table_args__ = (
        Index("ix_conversations_session_updated", "session_id", "updated_at"),
    )


class Message(Base):
    """A message (user or assistant) inside a conversation."""

    __tablename__ = "messages"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20))  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text)

    # "text" | "compare" | "passage"
    kind: Mapped[str] = mapped_column(String(20), default="text")

    # Structured payload for compare / passage messages
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Resolved citations: [{book, chapter, verse_start, verse_end, translation, text}]
    citations_json: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    cost_usd: Mapped[float | None] = mapped_column(nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
