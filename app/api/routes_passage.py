"""
POST /passage — fetch a passage with optional cross-Gospel parallels and synthesis.
"""

import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.db.models import GOSPEL_BOOKS
from app.rag.generation import _get_client  # noqa: PLC2701

router = APIRouter(prefix="/passage", tags=["passage"])

_REF_RE = re.compile(
    r"^(?P<book>[A-Z]{3})\s+(?P<chapter>\d+):(?P<vs>\d+)(?:-(?P<ve>\d+))?$"
)

# Known parallel pericopes (subset for demo — extend as needed)
_PARALLELS: dict[str, list[str]] = {
    "MAT 5:3-12": ["LUK 6:20-23"],
    "MAT 14:13-21": ["MRK 6:31-44", "LUK 9:10-17", "JHN 6:1-13"],
    "MAT 26:26-29": ["MRK 14:22-25", "LUK 22:14-20"],
    "MAT 28:1-10": ["MRK 16:1-8", "LUK 24:1-12", "JHN 20:1-18"],
    "MRK 1:1-11": ["MAT 3:1-17", "LUK 3:1-22"],
    "JHN 3:1-21": [],
    "LUK 15:11-32": [],
}

DEFAULT_TRANSLATION = "WEB"


class PassageRequest(BaseModel):
    reference: str = Field(..., description="e.g. 'MAT 14:13-21'")
    translation_id: str = Field(default=DEFAULT_TRANSLATION)
    include_parallels: bool = False
    synthesize: bool = False


class VerseData(BaseModel):
    verse: int
    text: str


class ParallelPassage(BaseModel):
    reference: str
    book_name: str
    translation_id: str
    verses: list[VerseData]


class PassageResponse(BaseModel):
    reference: str
    book_name: str
    translation_id: str
    verses: list[VerseData]
    parallels: list[ParallelPassage]
    synthesis: str | None = None


def _parse_ref(ref: str) -> tuple[str, int, int, int]:
    m = _REF_RE.match(ref.strip().upper())
    if not m:
        raise HTTPException(400, f"Invalid reference '{ref}'.")
    book = m.group("book")
    if book not in GOSPEL_BOOKS:
        raise HTTPException(400, f"'{book}' is not in the four Gospels.")
    return (
        book,
        int(m.group("chapter")),
        int(m.group("vs")),
        int(m.group("ve")) if m.group("ve") else int(m.group("vs")),
    )


async def _fetch_verses(
    db: AsyncSession,
    book: str,
    chapter: int,
    vs: int,
    ve: int,
    translation_id: str,
) -> list[VerseData]:
    sql = text("""
        SELECT verse, text
        FROM verses
        WHERE book = :book AND chapter = :chapter
          AND verse BETWEEN :vs AND :ve
          AND translation_id = :tid
        ORDER BY verse
    """)
    rows = (await db.execute(sql, {
        "book": book, "chapter": chapter, "vs": vs, "ve": ve, "tid": translation_id,
    })).fetchall()
    return [VerseData(verse=r.verse, text=r.text) for r in rows]


async def _synthesize(
    reference: str,
    main_passage: list[VerseData],
    parallels: list[ParallelPassage],
) -> str:
    settings = get_settings()
    client = _get_client()

    parallel_texts = "\n\n".join(
        f"{p.reference} ({p.translation_id}):\n"
        + "\n".join(f"v{v.verse}: {v.text}" for v in p.verses)
        for p in parallels
    )
    main_text = "\n".join(f"v{v.verse}: {v.text}" for v in main_passage)

    response = await client.messages.create(
        model=settings.generation_model,
        max_tokens=600,
        messages=[{
            "role": "user",
            "content": (
                f"You are a biblical scholar. Compare and synthesize the following Gospel accounts "
                f"of {reference}.\n\n"
                f"Primary passage ({reference}):\n{main_text}\n\n"
                f"Parallel accounts:\n{parallel_texts}\n\n"
                "Write a concise scholarly synthesis (3-5 sentences) highlighting similarities, "
                "differences, and theological themes across the accounts."
            ),
        }],
    )
    return response.content[0].text


@router.post("", response_model=PassageResponse)
async def passage(
    body: PassageRequest,
    db: AsyncSession = Depends(get_db),
) -> PassageResponse:
    book, chapter, vs, ve = _parse_ref(body.reference)
    ref_upper = f"{book} {chapter}:{vs}" + (f"-{ve}" if ve != vs else "")
    translation_id = body.translation_id.upper()

    main_verses = await _fetch_verses(db, book, chapter, vs, ve, translation_id)

    parallels: list[ParallelPassage] = []
    if body.include_parallels:
        parallel_refs = _PARALLELS.get(ref_upper, [])
        for pref in parallel_refs:
            pb, pc, pvs, pve = _parse_ref(pref)
            pverses = await _fetch_verses(db, pb, pc, pvs, pve, translation_id)
            parallels.append(ParallelPassage(
                reference=pref,
                book_name=GOSPEL_BOOKS.get(pb, pb),
                translation_id=translation_id,
                verses=pverses,
            ))

    synthesis: str | None = None
    if body.synthesize and parallels:
        synthesis = await _synthesize(ref_upper, main_verses, parallels)

    return PassageResponse(
        reference=ref_upper,
        book_name=GOSPEL_BOOKS.get(book, book),
        translation_id=translation_id,
        verses=main_verses,
        parallels=parallels,
        synthesis=synthesis,
    )
