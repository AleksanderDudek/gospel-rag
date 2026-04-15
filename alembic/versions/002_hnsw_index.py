"""Add HNSW vector index after data is loaded.

Run this migration AFTER running `python -m data.gospels_loader`.

Revision ID: 002
Revises: 001
"""

from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # HNSW index for approximate nearest neighbour search.
    # Requires data to exist (at least 1 row) before creation.
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_verses_embedding_hnsw
        ON verses USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_verses_embedding_hnsw")
