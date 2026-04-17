# Gospel RAG

> **A production-grade Retrieval-Augmented Generation system for the four Gospels** — streaming chat, inline verse citations, cross-translation comparison, and passage synthesis. Built without LangChain, on raw pgvector + Claude.

**[Live Demo →](https://gospel-rag-web.onrender.com)**

---

![Gospel RAG Chat](https://raw.githubusercontent.com/AleksanderDudek/gospel-rag/main/docs/screenshot.png)

---

## What it does

Ask a question about the Gospels and get a grounded, citation-backed answer — streamed token by token from Claude Sonnet, with each verse reference rendered as an interactive chip that opens a side panel with the full verse across all four translations.

```text
"Who carried Jesus's cross?"
→ [MAT 27:32, KJV] "And as they came out, they found a man of Cyrene, Simon by name..."
→ [MRK 15:21, WEB] "They pressed into service a passerby, Simon of Cyrene..."
→ [LUK 23:26, ASV] "And when they led him away, they laid hold upon one Simon of Cyrene..."
```

It also understands slash commands for structured views:

| Command | What it does |
| --- | --- |
| `/compare MAT 5:3-12 KJV WEB YLT` | Side-by-side scrollable translation table |
| `/passage MAT 14:13-21 --parallels --synthesize` | Passage + cross-Gospel parallels + AI synthesis |

---

## Architecture & Philosophy

The core design principle: **no framework magic, just SQL and streaming.**

```text
Browser
  └── Next.js 15 App Router + Vercel AI SDK useChat
        └── /api/proxy/* (cookie pass-through, SSE relay)
              └── FastAPI backend
                    ├── /query      — hybrid RAG + Claude streaming
                    ├── /compare    — translation viewer
                    ├── /passage    — parallels + synthesis
                    └── /conversations/* — session-scoped CRUD
                          └── PostgreSQL 16
                                ├── pgvector   (cosine similarity search)
                                └── tsvector   (full-text search)
                    └── Voyage AI  (voyage-3-lite 512d embeddings)
                    └── Claude API (Sonnet 4.6 generation, Haiku 4.5 titling)
```

### Retrieval: Hybrid RRF Search

Pure SQL — no vector middleware, no LangChain, no LlamaIndex. Two parallel queries fused with Reciprocal Rank Fusion:

```sql
-- Semantic: dense vector cosine similarity via HNSW index
-- Lexical:  PostgreSQL websearch_to_tsquery full-text
-- Fusion:   SUM(1 / (60 + rank)) across both result lists
```

This beats either search alone: semantic catches paraphrases and concepts, lexical catches exact names and rare words. RRF normalises the rank lists without needing calibrated scores.

### Streaming: Vercel AI SDK Protocol

The backend speaks the Vercel AI SDK data stream format natively. Text tokens arrive as `0:"token"\n` lines. After the stream ends, citations are parsed from the full text and sent as a single structured `2:[{...}]\n` data event — so the frontend can hydrate citation chips without a second round-trip.

### Sessions: Zero Auth, Zero Friction

Anonymous UUID sessions via `HttpOnly` cookies. No login, no email. Open incognito and you get a clean, isolated session automatically.

---

## Tech Stack

| Layer | Tech |
| --- | --- |
| Backend | Python 3.12, FastAPI, SQLAlchemy async, asyncpg |
| Database | PostgreSQL 16 + pgvector (HNSW), tsvector FTS |
| Embeddings | Voyage AI `voyage-3-lite` (512 dimensions) |
| Generation | Claude Sonnet 4.6 (answers) + Haiku 4.5 (auto-titling) |
| Frontend | Next.js 15 App Router, TypeScript strict mode |
| UI | Tailwind CSS v4, shadcn/ui, lucide-react |
| Streaming | Vercel AI SDK `useChat` + SSE data stream protocol |
| Package mgr | `uv` (Python), `pnpm` (Node) |
| Hosting | Render (API + web), Neon (Postgres), Vercel (alt frontend) |
| CI | GitHub Actions (tests + typecheck + Docker build) |

---

## Features

- **Streaming answers** — tokens arrive as Claude generates them, no waiting
- **Citation chips** — every `[MAT 5:3, KJV]` reference is an interactive button that opens a side panel with the verse across all translations
- **`/compare`** — horizontally scrollable grid of translations for any passage
- **`/passage`** — passage viewer with synoptic parallels and AI synthesis
- **Auto-titled conversations** — Claude Haiku generates a 4-word title from your first message
- **Persistent history** — conversations survive page reloads, stored per session
- **Session isolation** — incognito = fresh session, no data leakage
- **Dark theme** — because late-night Gospel study is a thing
- **⌘K / Ctrl+K** — keyboard shortcut for new chat

---

## Quick Start (Docker)

```bash
# 1. Clone and configure
git clone https://github.com/AleksanderDudek/gospel-rag
cd gospel-rag
cp .env.example .env
# Edit .env — add ANTHROPIC_API_KEY and VOYAGE_API_KEY

# 2. Start Postgres + backend + frontend
docker compose up -d

# 3. Load the four Gospels (KJV, WEB, ASV, YLT — ~19k verses, ~4 min)
docker compose exec app python -m data.gospels_loader

# 4. Build the HNSW vector index
docker compose exec app alembic upgrade 002

# 5. Open http://localhost:3000
```

---

## Local Development

### Backend

```bash
# Install uv (https://astral.sh/uv)
curl -LsSf https://astral.sh/uv/install.sh | sh

uv sync --all-extras
docker compose up postgres -d
uv run alembic upgrade head
uv run python -m data.gospels_loader
uv run alembic upgrade 002       # builds HNSW index
uv run uvicorn app.main:app --reload
```

### Frontend

```bash
cd web
cp .env.example .env.local       # set BACKEND_INTERNAL_URL=http://localhost:8000
pnpm install
pnpm dlx shadcn@latest add button input dialog dropdown-menu sheet scroll-area separator tooltip skeleton
pnpm dev                          # → http://localhost:3000
```

---

## Translations

All public domain — loaded from the Berean Standard Bible project and legacy sources:

| Code | Translation | Year |
| --- | --- | --- |
| KJV | King James Version | 1611 |
| WEB | World English Bible | ongoing |
| ASV | American Standard Version | 1901 |
| YLT | Young's Literal Translation | 1898 |

~19,000 verses across 4 translations × 4 books = ~76,000 rows with vector embeddings.

---

## API Reference

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/query` | Streaming hybrid RAG query |
| `POST` | `/compare` | Side-by-side translation comparison |
| `POST` | `/passage` | Passage + cross-Gospel parallels + AI synthesis |
| `POST` | `/conversations` | Create conversation |
| `GET` | `/conversations` | List conversations (session-scoped) |
| `GET` | `/conversations/{id}` | Get conversation + messages |
| `PATCH` | `/conversations/{id}` | Rename |
| `DELETE` | `/conversations/{id}` | Delete (cascades to messages) |
| `POST` | `/conversations/{id}/messages` | Send message (streaming) |

Interactive docs: `http://localhost:8000/docs`

---

## Deployment

### Fully automated via `render.yaml`

Connect the repo in [Render](https://render.com) → **New Blueprint** → select `render.yaml`. Two services are provisioned automatically (API + web). Set four secrets in the dashboard:

```bash
ANTHROPIC_API_KEY   — from console.anthropic.com
VOYAGE_API_KEY      — from dash.voyageai.com
DATABASE_URL        — Neon connection string (see below)
ALLOWED_ORIGINS     — https://your-frontend.onrender.com
```

### Database — Neon (free tier)

1. Create a project at [neon.tech](https://neon.tech)
2. Enable the `pgvector` extension
3. Copy the connection string → paste as `DATABASE_URL` in Render

### After deploy — load data once

```bash
# From the Render shell for gospel-rag-api
python -m data.gospels_loader
alembic upgrade 002
```

### Frontend — Vercel (alternative)

```bash
cd web && vercel deploy
# Set BACKEND_INTERNAL_URL to your Render API URL
```

---

## Testing

```bash
# Backend unit + integration tests (requires Postgres)
uv run pytest tests/ -v

# Frontend type check + lint
cd web && pnpm typecheck && pnpm lint

# End-to-end (Playwright, requires full running stack)
cd web && pnpm test:e2e
```

CI runs all three on every push to `main`, with a real `pgvector/pgvector:pg16` service container for the backend tests.

---

## Future Development

The core RAG loop is solid. What comes next depends on which axis matters most:

### Richer retrieval

- Re-ranking pass (Cohere Rerank or a cross-encoder) to tighten the top-k before generation
- Book-level and chapter-level embeddings as coarse filters before verse-level search
- Query expansion: generate 3 paraphrases, search all, merge results

### Deeper Scripture tooling

- Strong's concordance integration — link Greek/Hebrew lemmas to search results
- Interlinear viewer as a slash command (`/interlinear JHN 1:1`)
- Thematic tagging index (parables, miracles, discourses) as structured metadata filters

### Scale and quality

- Expand beyond the four Gospels to the full New Testament or Bible
- Ragas eval harness for measuring retrieval precision and answer faithfulness
- Prompt caching for the system prompt to reduce Claude API cost at scale

### Production hardening

- Real authentication (NextAuth / Clerk) for per-user history and sharing
- Conversation export (Markdown, PDF)
- Rate limiting per session
- Terraform IaC for AWS ECS/Fargate (the `render.yaml` covers the free-tier path)

---

## License

MIT — do whatever you want with it.

---

Built with Claude Sonnet 4.6, Voyage AI embeddings, and a lot of Greek cross-referencing.
