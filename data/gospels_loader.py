"""
Gospel data loader — uses github.com/thiagobodruk/bible
(single JSON file per translation, no rate limits, no API key).

Each file is ~5 MB and downloads in < 2 seconds.

Usage:
    uv run python -m data.gospels_loader
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

# thiagobodruk/bible: one JSON file per translation, ~3-6 MB each
_BASE = "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/{filename}"

# (our abbr, display name, filename in the repo)
# All public domain. The loader silently skips any file that returns 404.
# Re-run the loader anytime to add more — already-loaded translations are skipped.
_TRANSLATIONS = [
    # ── English ───────────────────────────────────────────────────────────────
    ("KJV", "King James Version",           "en_kjv.json"),
    ("BBE", "Bible in Basic English",        "en_bbe.json"),
    # ── Add more after unlocking Voyage AI rate limits (add payment method) ──
    # ("GRK", "Greek (Elzevir Textus Receptus)", "el_greek.json"),
    # ("RVR", "Reina-Valera (Spanish)",      "es_rvr.json"),
    # ("NVI", "Nova Versão Internacional (PT)", "pt_nvi.json"),
]

# In the 66-book Protestant canon (0-indexed), the Gospels are at indices 39-42.
# thiagobodruk stores books in canonical order, so these indices are reliable.
_GOSPEL_INDICES: dict[int, str] = {39: "MAT", 40: "MRK", 41: "LUK", 42: "JHN"}

_INSERT_BATCH = 500


def _parse_thiago(raw: list) -> list[dict]:
    """
    Parse thiagobodruk format into flat verse dicts.

    Format:
        [
          {"abbrev": "gn", "chapters": [["verse1 text", "verse2 text"], ...]},
          ...  # 66 books in canonical order
        ]
    """
    verses: list[dict] = []
    for book_idx, book_code in _GOSPEL_INDICES.items():
        if book_idx >= len(raw):
            log.warning("  book index %d out of range (file has %d books)", book_idx, len(raw))
            continue
        book = raw[book_idx]
        chapters: list[list[str]] = book.get("chapters", [])
        for ch_idx, chapter_verses in enumerate(chapters, start=1):
            for v_idx, text in enumerate(chapter_verses, start=1):
                verses.append({
                    "book":    book_code,
                    "chapter": ch_idx,
                    "verse":   v_idx,
                    "text":    text.strip(),
                })
    return verses


async def _download(client: httpx.AsyncClient, filename: str) -> list | None:
    """Download one JSON translation file. Returns None on 404."""
    url = _BASE.format(filename=filename)
    log.info("  downloading %s …", url)
    resp = await client.get(url, timeout=60, follow_redirects=True)
    if resp.status_code == 404:
        log.warning("  404 — translation file not found, skipping.")
        return None
    resp.raise_for_status()
    return resp.json()


async def _load_into_db(
    factory: async_sessionmaker,
    abbr: str,
    name: str,
    verses: list[dict],
) -> None:
    """Embed verses and insert them into the database.

    Opens two short-lived sessions — one to check/register the translation,
    one to insert — with embedding happening between them so the connection
    is never held idle during the long Voyage API calls.
    """
    # ── Session 1: upsert translation + check if already loaded ──────────────
    async with factory() as session:
        await session.execute(text("""
            INSERT INTO translations (id, name, language, license)
            VALUES (:id, :name, 'en', 'Public Domain')
            ON CONFLICT (id) DO NOTHING
        """), {"id": abbr, "name": name})
        await session.commit()

        existing = (await session.execute(
            text("SELECT COUNT(*) FROM verses WHERE translation_id = :tid"),
            {"tid": abbr},
        )).scalar_one()

    if existing >= len(verses):
        log.info("  %s already loaded (%d verses), skipping.", abbr, existing)
        return

    # ── Embed (no DB connection held) ─────────────────────────────────────────
    log.info("  embedding %d verses…", len(verses))
    all_embeddings = await embed_texts([v["text"] for v in verses])

    # ── Session 2: insert in batches ──────────────────────────────────────────
    log.info("  inserting into DB…")
    async with factory() as session:
        for i in range(0, len(verses), _INSERT_BATCH):
            bv = verses[i : i + _INSERT_BATCH]
            be = all_embeddings[i : i + _INSERT_BATCH]
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

    log.info("  ✓ %s — %d verses loaded", abbr, len(verses))


async def main() -> None:
    settings = get_settings()
    db_url, connect_args = _prepare_url(settings.database_url)
    engine   = create_async_engine(db_url, echo=False, connect_args=connect_args, pool_pre_ping=True)
    factory  = async_sessionmaker(engine, expire_on_commit=False)

    loaded = 0
    async with httpx.AsyncClient(headers={"User-Agent": "gospel-rag/1.0"}) as client:
        for abbr, name, filename in _TRANSLATIONS:
            log.info("\n── %s (%s) ──", abbr, name)
            raw = await _download(client, filename)
            if raw is None:
                continue

            verses = _parse_thiago(raw)
            if not verses:
                log.error("  Parsed 0 verses — check file format.")
                continue

            await _load_into_db(factory, abbr, name, verses)
            loaded += 1

    await engine.dispose()

    if loaded == 0:
        log.error("\nNo translations loaded. Check your internet connection.")
        sys.exit(1)

    log.info("\n✓ Done (%d translation(s) loaded).", loaded)
    log.info("Next step:  uv run alembic upgrade 002")


if __name__ == "__main__":
    asyncio.run(main())
