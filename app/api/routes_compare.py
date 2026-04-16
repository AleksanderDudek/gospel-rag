"""
POST /compare — fetch the same passage across multiple translations side-by-side.
"""

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import GOSPEL_BOOKS

router = APIRouter(prefix="/compare", tags=["compare"])

_REF_RE = re.compile(r"^(?P<book>[A-Z]{3})\s+(?P<chapter>\d+):(?P<vs>\d+)(?:-(?P<ve>\d+))?$")


class CompareRequest(BaseModel):
    reference: str = Field(..., description="e.g. 'MAT 5:3-12' or 'JHN 3:16'")
    translation_ids: list[str] = Field(..., min_length=2, description="e.g. ['KJV', 'WEB', 'YLT']")


class VerseData(BaseModel):
    verse: int
    text: str


class TranslationData(BaseModel):
    id: str
    verses: list[VerseData]


class CompareResponse(BaseModel):
    reference: str
    book_name: str
    translations: list[TranslationData]


def _parse_reference(ref: str) -> tuple[str, int, int, int]:
    m = _REF_RE.match(ref.strip().upper())
    if not m:
        raise HTTPException(400, f"Invalid reference '{ref}'. Use format BOOK CH:V or BOOK CH:V-V")
    book = m.group("book")
    if book not in GOSPEL_BOOKS:
        raise HTTPException(400, f"Book '{book}' not in the four Gospels (MAT, MRK, LUK, JHN)")
    chapter = int(m.group("chapter"))
    verse_start = int(m.group("vs"))
    verse_end = int(m.group("ve")) if m.group("ve") else verse_start
    return book, chapter, verse_start, verse_end


@router.post("", response_model=CompareResponse)
async def compare(
    body: CompareRequest,
    db: AsyncSession = Depends(get_db),
) -> CompareResponse:
    """Return the same passage across multiple translations for side-by-side display."""
    book, chapter, verse_start, verse_end = _parse_reference(body.reference)

    translation_ids_upper = [t.upper() for t in body.translation_ids]

    sql = text("""
        SELECT translation_id, verse, text
        FROM verses
        WHERE book = :book
          AND chapter = :chapter
          AND verse BETWEEN :verse_start AND :verse_end
          AND translation_id = ANY(:translation_ids)
        ORDER BY translation_id, verse
    """)
    result = await db.execute(
        sql,
        {
            "book": book,
            "chapter": chapter,
            "verse_start": verse_start,
            "verse_end": verse_end,
            "translation_ids": translation_ids_upper,
        },
    )
    rows = result.fetchall()

    # Group by translation
    by_translation: dict[str, list[VerseData]] = {}
    for row in rows:
        by_translation.setdefault(row.translation_id, []).append(
            VerseData(verse=row.verse, text=row.text)
        )

    # Maintain requested order
    translations = [
        TranslationData(id=tid, verses=by_translation.get(tid, [])) for tid in translation_ids_upper
    ]

    return CompareResponse(
        reference=body.reference.upper(),
        book_name=GOSPEL_BOOKS.get(book, book),
        translations=translations,
    )
