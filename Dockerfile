# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

# Copy dependency manifests first (better layer caching)
COPY pyproject.toml .

# Install dependencies into a virtual env
RUN uv venv .venv && \
    uv pip install --no-cache -r pyproject.toml

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Non-root user
RUN addgroup --system app && adduser --system --ingroup app app

# Copy venv from builder
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Copy application code
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .
COPY data/ data/

RUN chown -R app:app /app
USER app

EXPOSE 8000

# Run migrations then start the server
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
