"""
Minimal fixture seed for CI tests.
Loads a tiny subset of KJV Matthew into the DB without calling external APIs.
Embeddings are zero vectors (sufficient to test the query pipeline shape).
"""

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_FIXTURE_VERSES = [
    ("MAT", 5, 3, "Blessed are the poor in spirit: for theirs is the kingdom of heaven."),
    ("MAT", 5, 4, "Blessed are they that mourn: for they shall be comforted."),
    ("MAT", 5, 5, "Blessed are the meek: for they shall inherit the earth."),
    (
        "MRK",
        15,
        21,
        "And they compel one Simon a Cyrenian, who passed by, coming out of the country, the father of Alexander and Rufus, to bear his cross.",
    ),
    (
        "LUK",
        23,
        26,
        "And as they led him away, they laid hold upon one Simon, a Cyrenian, coming out of the country, and on him they laid the cross, that he might bear it after Jesus.",
    ),
    (
        "JHN",
        3,
        16,
        "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    ),
]

_DIMS = 512  # must match EMBEDDING_DIMENSIONS


async def seed_fixture(db: AsyncSession) -> None:
    """Insert a minimal corpus for integration tests."""
    await db.execute(
        text("""
        INSERT INTO translations (id, name, language, license)
        VALUES ('KJV', 'King James Version', 'en', 'Public Domain')
        ON CONFLICT (id) DO NOTHING
    """)
    )

    zero_vec = "[" + ",".join(["0.0"] * _DIMS) + "]"

    for book, chapter, verse, verse_text in _FIXTURE_VERSES:
        await db.execute(
            text("""
            INSERT INTO verses (translation_id, book, chapter, verse, text, embedding)
            VALUES ('KJV', :book, :chapter, :verse, :text, :emb::vector)
            ON CONFLICT DO NOTHING
        """),
            {
                "book": book,
                "chapter": chapter,
                "verse": verse,
                "text": verse_text,
                "emb": zero_vec,
            },
        )

    await db.commit()


if __name__ == "__main__":
    from app.db.database import AsyncSessionLocal

    async def _main():
        async with AsyncSessionLocal() as db:
            await seed_fixture(db)
        print("Fixture seeded.")

    asyncio.run(_main())
