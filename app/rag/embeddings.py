"""Voyage AI embedding client with batching."""

import asyncio
import logging
from functools import lru_cache

import voyageai

from app.config import get_settings

_BATCH_SIZE = 128  # Voyage AI max per request
# Delay between every batch request (including the first).
# Free tier = 3 RPM → 21 s keeps you safely under the limit.
# Set to 0 after adding a payment method to unlock standard rate limits.
_INTER_BATCH_DELAY = 21.0  # seconds
_RATE_LIMIT_BACKOFF = 65.0  # seconds to wait when a 429 slips through

log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_client() -> voyageai.AsyncClient:
    settings = get_settings()
    # max_retries=0 disables the client's internal tenacity retry so our own
    # long-sleep retry logic in _embed_batch_with_retry has full RPM control.
    return voyageai.AsyncClient(api_key=settings.voyage_api_key, max_retries=0)


async def _embed_batch_with_retry(
    client: voyageai.AsyncClient,
    batch: list[str],
    model: str,
    *,
    max_retries: int = 8,
) -> list[list[float]]:
    """Call client.embed with our own long-sleep retry on RateLimitError."""
    for attempt in range(max_retries):
        try:
            result = await client.embed(batch, model=model, input_type="document")
            return result.embeddings
        except voyageai.error.RateLimitError:
            if attempt == max_retries - 1:
                raise
            wait = _RATE_LIMIT_BACKOFF * (attempt + 1)
            log.warning(
                "  Rate limit hit — sleeping %.0fs before retry (%d/%d)…",
                wait, attempt + 1, max_retries,
            )
            await asyncio.sleep(wait)
    raise RuntimeError("unreachable")  # pragma: no cover


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts, processing in sequential batches of 128."""
    if not texts:
        return []

    client = _get_client()
    settings = get_settings()
    model = settings.embedding_model
    all_embeddings: list[list[float]] = []

    batches = [texts[i : i + _BATCH_SIZE] for i in range(0, len(texts), _BATCH_SIZE)]
    total = len(texts)
    for idx, batch in enumerate(batches):
        if _INTER_BATCH_DELAY > 0:
            await asyncio.sleep(_INTER_BATCH_DELAY)
        embeddings = await _embed_batch_with_retry(client, batch, model)
        all_embeddings.extend(embeddings)
        done = min((idx + 1) * _BATCH_SIZE, total)
        if idx % 5 == 4 or done == total:
            log.info("    embedded %d / %d", done, total)

    return all_embeddings


async def embed_query(text: str) -> list[float]:
    """Embed a single query string (uses query input_type for better retrieval)."""
    client = _get_client()
    settings = get_settings()
    for attempt in range(8):
        try:
            result = await client.embed(
                [text], model=settings.embedding_model, input_type="query"
            )
            return result.embeddings[0]
        except voyageai.error.RateLimitError:
            if attempt == 7:
                raise
            wait = _RATE_LIMIT_BACKOFF * (attempt + 1)
            log.warning("embed_query rate limit — sleeping %.0fs (attempt %d/8)…", wait, attempt + 1)
            await asyncio.sleep(wait)
    raise RuntimeError("unreachable")  # pragma: no cover
