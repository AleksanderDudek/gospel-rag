"""
GET /verses/{book}/{chapter}/{verse} — single-verse text lookup.
Used by the frontend citation side panel to fill in verse text that was
not captured in the original retrieval context.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import GOSPEL_BOOKS

router = APIRouter(prefix="/verses", tags=["verses"])


@router.get("/{book}/{chapter}/{verse}")
async def get_verse(
    book: str,
    chapter: int,
    verse: int,
    translation: str = Query(..., description="Translation ID, e.g. 'KJV'"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    book = book.upper()
    translation = translation.upper()

    if book not in GOSPEL_BOOKS:
        raise HTTPException(400, f"Book '{book}' not in the four Gospels (MAT, MRK, LUK, JHN)")

    result = await db.execute(
        text("""
            SELECT text FROM verses
            WHERE book = :book AND chapter = :chapter
              AND verse = :verse AND translation_id = :translation
        """),
        {"book": book, "chapter": chapter, "verse": verse, "translation": translation},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "Verse not found")

    return {
        "book": book,
        "chapter": chapter,
        "verse": verse,
        "translation": translation,
        "text": row.text,
    }
