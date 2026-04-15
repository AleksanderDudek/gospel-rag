"""
Hybrid retrieval: pgvector cosine similarity + PostgreSQL tsvector FTS,
combined with Reciprocal Rank Fusion (RRF).
"""

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.rag.embeddings import embed_query

_RRF_K = 60  # standard RRF constant


@dataclass
class RetrievedVerse:
    id: int
    book: str
    chapter: int
    verse: int
    translation_id: str
    verse_text: str
    rrf_score: float

    @property
    def reference(self) -> str:
        return f"{self.book} {self.chapter}:{self.verse}"

    @property
    def citation_key(self) -> str:
        return f"[{self.book} {self.chapter}:{self.verse}, {self.translation_id}]"

    def to_context_line(self) -> str:
        return f"{self.citation_key} \"{self.verse_text}\""


async def hybrid_search(
    db: AsyncSession,
    query: str,
    translation_ids: list[str] | None = None,
    books: list[str] | None = None,
) -> list[RetrievedVerse]:
    """
    Run hybrid (vector + FTS) search and return top_k results via RRF.

    Args:
        db: Async DB session.
        query: Natural language query.
        translation_ids: Filter to specific translations (None = all).
        books: Filter to specific gospel books (None = all four).
    """
    settings = get_settings()
    top_k = settings.retrieval_top_k
    candidates = settings.retrieval_candidates

    query_embedding = await embed_query(query)
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    # Build optional WHERE clauses
    filters: list[str] = []
    params: dict = {
        "query_embedding": embedding_str,
        "candidates": candidates,
        "top_k": top_k,
        "ts_query": query,
    }
    if translation_ids:
        filters.append("translation_id = ANY(:translation_ids)")
        params["translation_ids"] = translation_ids
    if books:
        filters.append("book = ANY(:books)")
        params["books"] = books

    where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""

    sql = text(f"""
        WITH semantic AS (
            SELECT id,
                   ROW_NUMBER() OVER (ORDER BY embedding <=> CAST(:query_embedding AS vector)) AS rank
            FROM verses
            {where_clause}
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:query_embedding AS vector)
            LIMIT :candidates
        ),
        fts AS (
            SELECT id,
                   ROW_NUMBER() OVER (ORDER BY ts_rank(search_vector, query) DESC) AS rank
            FROM verses,
                 websearch_to_tsquery('english', :ts_query) AS query
            {where_clause}
            WHERE search_vector @@ query
            ORDER BY ts_rank(search_vector, query) DESC
            LIMIT :candidates
        ),
        rrf AS (
            SELECT id,
                   SUM(1.0 / ({_RRF_K} + rank)) AS score
            FROM (
                SELECT id, rank FROM semantic
                UNION ALL
                SELECT id, rank FROM fts
            ) combined
            GROUP BY id
            ORDER BY score DESC
            LIMIT :top_k
        )
        SELECT
            v.id, v.book, v.chapter, v.verse,
            v.translation_id, v.text,
            rrf.score
        FROM rrf
        JOIN verses v ON v.id = rrf.id
        ORDER BY rrf.score DESC
    """)

    # Re-apply filters with correct names for the outer query (deduplicate params)
    if translation_ids:
        params["translation_ids"] = translation_ids
    if books:
        params["books"] = books

    result = await db.execute(sql, params)
    rows = result.fetchall()

    return [
        RetrievedVerse(
            id=row.id,
            book=row.book,
            chapter=row.chapter,
            verse=row.verse,
            translation_id=row.translation_id,
            verse_text=row.text,
            rrf_score=float(row.score),
        )
        for row in rows
    ]


async def fetch_passage(
    db: AsyncSession,
    book: str,
    chapter: int,
    verse_start: int,
    verse_end: int,
    translation_id: str,
) -> list[RetrievedVerse]:
    """Fetch a specific passage by reference."""
    sql = text("""
        SELECT id, book, chapter, verse, translation_id, text
        FROM verses
        WHERE book = :book
          AND chapter = :chapter
          AND verse BETWEEN :verse_start AND :verse_end
          AND translation_id = :translation_id
        ORDER BY verse
    """)
    result = await db.execute(sql, {
        "book": book,
        "chapter": chapter,
        "verse_start": verse_start,
        "verse_end": verse_end,
        "translation_id": translation_id,
    })
    return [
        RetrievedVerse(
            id=row.id,
            book=row.book,
            chapter=row.chapter,
            verse=row.verse,
            translation_id=row.translation_id,
            verse_text=row.text,
            rrf_score=1.0,
        )
        for row in result.fetchall()
    ]
