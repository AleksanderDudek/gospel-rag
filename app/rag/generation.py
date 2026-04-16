"""
Claude streaming generation with citation grounding.
Implements the Vercel AI SDK data stream protocol (v1).
"""

import json
import re
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from functools import lru_cache

import anthropic

from app.config import get_settings
from app.rag.retrieval import RetrievedVerse

_CITATION_RE = re.compile(r"\[([A-Z]{3})\s+(\d+):(\d+(?:-\d+)?),\s*([A-Z]+)\]")

_SYSTEM_PROMPT = """\
You are a knowledgeable biblical scholar specializing in the four Gospels \
(Matthew, Mark, Luke, John).

When answering questions:
1. Ground every claim in the context passages provided below.
2. Cite each verse you reference using the format [BOOK CH:V, TRANSLATION] \
   — e.g., [MAT 5:3, WEB] or [JHN 3:16, KJV].
3. For verse ranges use [BOOK CH:V-V, TRANSLATION] — e.g., [MAT 5:3-12, WEB].
4. Be accurate and scholarly but also accessible to a general reader.
5. If the provided context is insufficient, say so clearly rather than guessing.

Context passages (use these as your primary sources):
{context}
"""


@dataclass
class Citation:
    book: str
    chapter: int
    verse_start: int
    verse_end: int
    translation: str
    text: str


@lru_cache(maxsize=1)
def _get_client() -> anthropic.AsyncAnthropic:
    settings = get_settings()
    return anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)


def _build_context(verses: list[RetrievedVerse]) -> str:
    return "\n".join(v.to_context_line() for v in verses)


def _parse_citations(
    text: str,
    verse_map: dict[str, RetrievedVerse],
) -> list[Citation]:
    """Extract and resolve [BOOK CH:V, TRANS] markers from generated text."""
    citations: list[Citation] = []
    seen: set[str] = set()

    for match in _CITATION_RE.finditer(text):
        book, chapter_s, verse_s, translation = match.groups()
        chapter = int(chapter_s)
        if "-" in verse_s:
            start_s, end_s = verse_s.split("-", 1)
            verse_start, verse_end = int(start_s), int(end_s)
        else:
            verse_start = verse_end = int(verse_s)

        key = f"{book}{chapter}:{verse_start}-{verse_end},{translation}"
        if key in seen:
            continue
        seen.add(key)

        # Look up verse text from retrieved context
        lookup_key = f"{book}{chapter}:{verse_start},{translation}"
        verse = verse_map.get(lookup_key)
        verse_text = verse.verse_text if verse else ""

        citations.append(
            Citation(
                book=book,
                chapter=chapter,
                verse_start=verse_start,
                verse_end=verse_end,
                translation=translation,
                text=verse_text,
            )
        )

    return citations


# ── Vercel AI SDK data stream helpers ────────────────────────────────────────


def _text_delta(token: str) -> str:
    return f"0:{json.dumps(token)}\n"


def _data_event(data: list) -> str:
    return f"2:{json.dumps(data)}\n"


def _finish_event(finish_reason: str, input_tokens: int, output_tokens: int) -> str:
    payload = {
        "finishReason": finish_reason,
        "usage": {
            "promptTokens": input_tokens,
            "completionTokens": output_tokens,
        },
    }
    return f"d:{json.dumps(payload)}\n"


# ── Public API ────────────────────────────────────────────────────────────────


async def stream_rag_response(
    query: str,
    context_verses: list[RetrievedVerse],
    conversation_history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """
    Stream a RAG response as Vercel AI SDK data stream lines.

    Yields:
        Lines in the format:
          0:"token"           → text delta
          2:[{citations}]     → structured data (sent once after streaming)
          d:{finish}          → finish marker
    """
    settings = get_settings()
    client = _get_client()

    context_text = _build_context(context_verses)
    system = _SYSTEM_PROMPT.format(context=context_text)

    # Build messages list (history + current query)
    messages: list[dict] = []
    if conversation_history:
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": query})

    full_text = ""
    input_tokens = 0
    output_tokens = 0

    async with client.messages.stream(
        model=settings.generation_model,
        system=system,
        messages=messages,
        max_tokens=2048,
    ) as stream:
        async for chunk in stream.text_stream:
            full_text += chunk
            yield _text_delta(chunk)

        final_msg = await stream.get_final_message()
        input_tokens = final_msg.usage.input_tokens
        output_tokens = final_msg.usage.output_tokens

    # Build citation lookup map from retrieved verses
    verse_map = {f"{v.book}{v.chapter}:{v.verse},{v.translation_id}": v for v in context_verses}
    citations = _parse_citations(full_text, verse_map)
    cost_usd = _estimate_cost(settings.generation_model, input_tokens, output_tokens)

    # Send structured data event with citations + cost
    yield _data_event(
        [
            {
                "citations": [
                    {
                        "book": c.book,
                        "chapter": c.chapter,
                        "verse_start": c.verse_start,
                        "verse_end": c.verse_end,
                        "translation": c.translation,
                        "text": c.text,
                    }
                    for c in citations
                ],
                "cost_usd": cost_usd,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "full_text": full_text,
            }
        ]
    )

    yield _finish_event("stop", input_tokens, output_tokens)


async def generate_title(first_message: str) -> str:
    """Use Claude Haiku to generate a short conversation title."""
    settings = get_settings()
    client = _get_client()

    response = await client.messages.create(
        model=settings.titling_model,
        max_tokens=30,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Generate a concise 4-word title for a conversation that starts with this "
                    f'question: "{first_message[:200]}"\n\n'
                    "Respond with ONLY the title, no punctuation, no quotes."
                ),
            }
        ],
    )
    title = response.content[0].text.strip()
    # Truncate to reasonable length just in case
    return title[:80] if title else "Gospel conversation"


def _estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Rough cost estimate in USD (prices as of mid-2025)."""
    # Sonnet 4.6 pricing: $3/1M input, $15/1M output
    # Haiku 4.5 pricing: $0.25/1M input, $1.25/1M output
    if "haiku" in model.lower():
        return (input_tokens * 0.25 + output_tokens * 1.25) / 1_000_000
    return (input_tokens * 3 + output_tokens * 15) / 1_000_000
