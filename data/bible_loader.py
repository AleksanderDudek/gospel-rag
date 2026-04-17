"""
Full Bible loader with book-level checkpointing.

Source: github.com/thiagobodruk/bible — one JSON file per translation,
~5 MB each, no API key, no rate limits on the download side.

Voyage AI embeddings are rate-limited on the free tier (3 RPM).
The loader batches in groups of 128 verses with 21-second inter-batch delays.
A payment method on Voyage AI removes this limit.

Progress is saved to data/progress.json after every book so the script can
be interrupted and resumed without re-embedding already-processed books.

Usage:
    uv run python -m data.bible_loader

    # To re-process a single translation, remove its key from progress.json:
    # e.g. delete the "ASV" key and re-run.

After loading all desired translations, rebuild the HNSW vector index:
    uv run alembic upgrade 002
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import get_settings  # noqa: E402
from app.db.database import _prepare_url  # noqa: E402
from app.rag.embeddings import embed_texts  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Source ────────────────────────────────────────────────────────────────────

_BASE = "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/{filename}"

# All public domain. Comment out translations you don't need to save storage.
# Neon free tier: 512 MB. Rough storage cost per translation: ~62 MB (embeddings
# dominate). KJV + BBE (Gospels only) are already loaded = ~37 MB used.
_TRANSLATIONS = [
    ("KJV", "King James Version",            "en_kjv.json"),
    ("BBE", "Bible in Basic English",        "en_bbe.json"),
    ("ASV", "American Standard Version",     "en_asv.json"),
    ("WEB", "World English Bible",           "en_web.json"),
    ("YLT", "Young's Literal Translation",   "en_ylt.json"),
    # Non-English (uncomment as needed):
    # ("GRK", "Greek (Elzevir Textus Receptus)", "el_greek.json"),
    # ("RVR", "Reina-Valera (Spanish)",       "es_rvr.json"),
]

# ── Book index → USFM code (Protestant 66-book canon, 0-indexed) ─────────────

_ALL_BOOKS: dict[int, str] = {
    0: "GEN",  1: "EXO",  2: "LEV",  3: "NUM",  4: "DEU",
    5: "JOS",  6: "JDG",  7: "RUT",  8: "1SA",  9: "2SA",
    10: "1KI", 11: "2KI", 12: "1CH", 13: "2CH", 14: "EZR",
    15: "NEH", 16: "EST", 17: "JOB", 18: "PSA", 19: "PRO",
    20: "ECC", 21: "SNG", 22: "ISA", 23: "JER", 24: "LAM",
    25: "EZK", 26: "DAN", 27: "HOS", 28: "JOL", 29: "AMO",
    30: "OBA", 31: "JON", 32: "MIC", 33: "NAM", 34: "HAB",
    35: "ZEP", 36: "HAG", 37: "ZEC", 38: "MAL",
    39: "MAT", 40: "MRK", 41: "LUK", 42: "JHN", 43: "ACT",
    44: "ROM", 45: "1CO", 46: "2CO", 47: "GAL", 48: "EPH",
    49: "PHP", 50: "COL", 51: "1TH", 52: "2TH", 53: "1TI",
    54: "2TI", 55: "TIT", 56: "PHM", 57: "HEB", 58: "JAS",
    59: "1PE", 60: "2PE", 61: "1JN", 62: "2JN", 63: "3JN",
    64: "JUD", 65: "REV",
}

# ── Checkpoint ────────────────────────────────────────────────────────────────

_PROGRESS_FILE = Path(__file__).parent / "progress.json"
_INSERT_BATCH = 500


def _load_progress() -> dict[str, list[str]]:
    """Load progress from disk. Returns {} if no progress file exists yet."""
    if _PROGRESS_FILE.exists():
        return json.loads(_PROGRESS_FILE.read_text())
    return {}


def _save_progress(progress: dict[str, list[str]]) -> None:
    _PROGRESS_FILE.write_text(json.dumps(progress, indent=2))


# ── Download ──────────────────────────────────────────────────────────────────


async def _download(client: httpx.AsyncClient, filename: str) -> list | None:
    """Download one JSON translation file. Returns None on 404."""
    url = _BASE.format(filename=filename)
    log.info("  downloading %s …", url)
    resp = await client.get(url, timeout=60, follow_redirects=True)
    if resp.status_code == 404:
        log.warning("  404 — file not found, skipping translation.")
        return None
    resp.raise_for_status()
    return resp.json()


# ── Parse ─────────────────────────────────────────────────────────────────────


def _parse_book(raw: list, book_idx: int, book_code: str) -> list[dict]:
    """
    Extract all verses for one book from the thiagobodruk JSON.

    Format:
        [
          {"abbrev": "gn", "chapters": [["v1 text", "v2 text", ...], ...]},
          ...  # 66 entries in canonical order
        ]
    """
    if book_idx >= len(raw):
        log.warning("  book index %d out of range (file has %d books)", book_idx, len(raw))
        return []

    book_data = raw[book_idx]
    chapters: list[list[str]] = book_data.get("chapters", [])
    verses: list[dict] = []
    for ch_idx, chapter_verses in enumerate(chapters, start=1):
        for v_idx, verse_text in enumerate(chapter_verses, start=1):
            text = verse_text.strip()
            if text:
                verses.append({
                    "book":    book_code,
                    "chapter": ch_idx,
                    "verse":   v_idx,
                    "text":    text,
                })
    return verses


# ── DB helpers ────────────────────────────────────────────────────────────────


async def _ensure_translation(factory: async_sessionmaker, abbr: str, name: str) -> None:
    """Upsert the translation row (idempotent)."""
    async with factory() as session:
        await session.execute(text("""
            INSERT INTO translations (id, name, language, license)
            VALUES (:id, :name, 'en', 'Public Domain')
            ON CONFLICT (id) DO NOTHING
        """), {"id": abbr, "name": name})
        await session.commit()


async def _load_book(
    factory: async_sessionmaker,
    abbr: str,
    book_code: str,
    verses: list[dict],
) -> None:
    """
    Embed and insert one book's verses.

    Opens two short-lived sessions — embed happens between them so no DB
    connection is held idle during the Voyage API call.
    """
    log.info("  [%s/%s] embedding %d verses…", abbr, book_code, len(verses))
    embeddings = await embed_texts([v["text"] for v in verses])

    log.info("  [%s/%s] inserting…", abbr, book_code)
    async with factory() as session:
        for i in range(0, len(verses), _INSERT_BATCH):
            bv = verses[i : i + _INSERT_BATCH]
            be = embeddings[i : i + _INSERT_BATCH]
            rows = [
                {
                    "tid":       abbr,
                    "book":      v["book"],
                    "chapter":   v["chapter"],
                    "verse":     v["verse"],
                    "text":      v["text"],
                    "embedding": "[" + ",".join(str(x) for x in e) + "]",
                }
                for v, e in zip(bv, be, strict=True)
            ]
            await session.execute(
                text("""
                    INSERT INTO verses (translation_id, book, chapter, verse, text, embedding)
                    VALUES (:tid, :book, :chapter, :verse, :text, CAST(:embedding AS vector))
                    ON CONFLICT DO NOTHING
                """),
                rows,
            )
            await session.commit()


# ── Main ──────────────────────────────────────────────────────────────────────


async def main() -> None:
    settings = get_settings()
    db_url, connect_args = _prepare_url(settings.database_url)
    engine  = create_async_engine(db_url, echo=False, connect_args=connect_args, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    progress = _load_progress()
    total_books_loaded = 0

    async with httpx.AsyncClient(headers={"User-Agent": "gospel-rag/1.0"}) as client:
        for abbr, name, filename in _TRANSLATIONS:
            log.info("\n── %s (%s) ──", abbr, name)
            raw = await _download(client, filename)
            if raw is None:
                continue

            await _ensure_translation(factory, abbr, name)

            completed: set[str] = set(progress.get(abbr, []))
            books_done_this_run = 0

            for book_idx, book_code in _ALL_BOOKS.items():
                if book_code in completed:
                    log.info("  [%s/%s] already done, skipping", abbr, book_code)
                    continue

                verses = _parse_book(raw, book_idx, book_code)
                if not verses:
                    log.warning("  [%s/%s] no verses parsed, skipping", abbr, book_code)
                    completed.add(book_code)
                    continue

                await _load_book(factory, abbr, book_code, verses)

                completed.add(book_code)
                progress[abbr] = sorted(completed)
                _save_progress(progress)

                books_done_this_run += 1
                total_books_loaded += 1
                log.info(
                    "  ✓ [%s/%s] %d verses saved  (progress: %d/66 books)",
                    abbr, book_code, len(verses), len(completed),
                )

            if books_done_this_run == 0:
                log.info("  %s — all 66 books already loaded.", abbr)
            else:
                log.info("  %s — finished (%d new books this run).", abbr, books_done_this_run)

    await engine.dispose()

    if total_books_loaded == 0:
        log.info("\nNo new books loaded — everything already up to date.")
    else:
        log.info("\n✓ Done. %d book(s) loaded across all translations.", total_books_loaded)
        log.info("Next step:  uv run alembic upgrade 002")


if __name__ == "__main__":
    asyncio.run(main())
