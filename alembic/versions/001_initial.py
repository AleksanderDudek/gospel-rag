"""Initial schema: translations, verses, conversations, messages.

Revision ID: 001
Revises:
Create Date: 2025-01-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── pgvector extension ───────────────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── translations ─────────────────────────────────────────────────────────
    op.create_table(
        "translations",
        sa.Column("id", sa.String(10), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("license", sa.String(200), nullable=False, server_default="Public Domain"),
    )

    # ── verses ───────────────────────────────────────────────────────────────
    op.create_table(
        "verses",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("translation_id", sa.String(10),
                  sa.ForeignKey("translations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("book", sa.String(5), nullable=False),
        sa.Column("chapter", sa.Integer, nullable=False),
        sa.Column("verse", sa.Integer, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("search_vector", TSVECTOR, nullable=True),
        # Vector column is added below with raw SQL (pgvector DDL)
    )
    # Add the vector column separately (pgvector syntax not in standard SA)
    op.execute("ALTER TABLE verses ADD COLUMN embedding vector(512)")

    # Indexes on verses
    op.create_index("ix_verses_book_chapter_verse", "verses", ["book", "chapter", "verse"])
    op.create_index("ix_verses_translation_book", "verses", ["translation_id", "book"])
    op.create_index(
        "ix_verses_search_vector", "verses", ["search_vector"],
        postgresql_using="gin",
    )

    # tsvector auto-update trigger
    op.execute("""
        CREATE FUNCTION verses_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector := to_tsvector('english', NEW.text);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER verses_search_vector_trigger
        BEFORE INSERT OR UPDATE ON verses
        FOR EACH ROW EXECUTE FUNCTION verses_search_vector_update();
    """)

    # ── conversations ─────────────────────────────────────────────────────────
    op.create_table(
        "conversations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False, server_default="New chat"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_conversations_session_updated",
        "conversations",
        ["session_id", sa.text("updated_at DESC")],
    )

    # ── messages ──────────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "conversation_id", UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("kind", sa.String(20), nullable=False, server_default="text"),
        sa.Column("payload_json", JSONB, nullable=True),
        sa.Column("citations_json", JSONB, nullable=True),
        sa.Column("cost_usd", sa.Float, nullable=True),
        sa.Column("input_tokens", sa.Integer, nullable=True),
        sa.Column("output_tokens", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])


def downgrade() -> None:
    op.drop_table("messages")
    op.drop_index("ix_conversations_session_updated", "conversations")
    op.drop_table("conversations")
    op.execute("DROP TRIGGER IF EXISTS verses_search_vector_trigger ON verses")
    op.execute("DROP FUNCTION IF EXISTS verses_search_vector_update")
    op.drop_table("verses")
    op.drop_table("translations")
    op.execute("DROP EXTENSION IF EXISTS vector")
