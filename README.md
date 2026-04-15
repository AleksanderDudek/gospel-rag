# Gospel RAG

A full-stack RAG (Retrieval-Augmented Generation) system for the four Gospels with a streaming chat UI. Built with FastAPI, pgvector, Claude, and Next.js 15.

## Architecture

```
Browser → Next.js 15 (App Router, useChat streaming)
            ↓ /api/proxy/* (cookie pass-through)
         FastAPI backend
            ├── /query     — hybrid RAG search + Claude streaming
            ├── /compare   — side-by-side translation viewer
            ├── /passage   — passage + parallels + synthesis
            └── /conversations/* — CRUD + session management
            ↓
         Postgres (pgvector + tsvector)
         Claude API (Sonnet for generation, Haiku for titling)
         Voyage AI (voyage-3-lite embeddings)
```

**Retrieval**: Hybrid search — pgvector cosine similarity + PostgreSQL `tsvector` FTS combined with Reciprocal Rank Fusion (RRF). No LangChain.

**Streaming**: SSE in the Vercel AI SDK data stream protocol. Citations are parsed from the generated text and sent as a structured data event after the text stream completes.

**Sessions**: Anonymous cookie-based sessions (UUID). No real auth required.

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy async, asyncpg |
| Database | PostgreSQL 16 + pgvector, tsvector FTS |
| Embeddings | Voyage AI `voyage-3-lite` (512d) |
| Generation | Anthropic Claude (Sonnet 4.6 / Haiku 4.5) |
| Frontend | Next.js 15 App Router, TypeScript strict |
| UI | Tailwind CSS, shadcn/ui, lucide-react |
| Streaming | Vercel AI SDK `useChat` with data stream protocol |
| Package mgr | `uv` (Python), `pnpm` (Node) |
| CI | GitHub Actions |
| Hosting | Render (backend), Vercel (frontend), Neon (DB) |

## Quick Start (Docker)

```bash
# 1. Clone and configure
git clone https://github.com/YOUR_USERNAME/gospel-rag
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

## Local Development (no Docker)

### Backend

```bash
# Install uv (https://docs.astral.sh/uv/getting-started/installation/)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync --all-extras

# Start Postgres (needs pgvector)
docker compose up postgres -d

# Run migrations
uv run alembic upgrade head

# Load data
uv run python -m data.gospels_loader

# Build HNSW index
uv run alembic upgrade 002

# Start API
uv run uvicorn app.main:app --reload
```

### Frontend

```bash
cd web
cp .env.example .env.local   # set BACKEND_INTERNAL_URL=http://localhost:8000

# Install dependencies
pnpm install

# Install shadcn components (needed once)
pnpm dlx shadcn@latest add button input dialog dropdown-menu sheet scroll-area separator tooltip skeleton

# Start dev server
pnpm dev
# → http://localhost:3000
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/query` | Streaming RAG query |
| `POST` | `/compare` | Side-by-side translation comparison |
| `POST` | `/passage` | Passage with parallels + synthesis |
| `POST` | `/conversations` | Create conversation |
| `GET` | `/conversations` | List conversations (session-scoped) |
| `GET` | `/conversations/{id}` | Get conversation with messages |
| `PATCH` | `/conversations/{id}` | Rename conversation |
| `DELETE` | `/conversations/{id}` | Delete conversation (cascades) |
| `POST` | `/conversations/{id}/messages` | Send message (streaming) |

Interactive docs at `http://localhost:8000/docs`.

## Slash Commands

Type `/` in the chat input for autocomplete:

| Command | Example | Description |
|---|---|---|
| `/compare` | `/compare MAT 5:3-12 KJV WEB YLT` | Side-by-side translations |
| `/passage` | `/passage MAT 14:13-21 --parallels --synthesize` | Passage + parallels + AI synthesis |

## Translations Loaded

All public domain:

- **KJV** — King James Version (1611)
- **WEB** — World English Bible
- **ASV** — American Standard Version (1901)
- **YLT** — Young's Literal Translation (1898)

## Running Tests

```bash
# Backend
uv run pytest tests/ -v

# Frontend typecheck + lint
cd web && pnpm typecheck && pnpm lint

# Frontend Playwright e2e (requires running stack)
cd web && pnpm test:e2e
```

## Deployment (Free Tier)

### Database — Neon

1. Create a free project at [neon.tech](https://neon.tech)
2. Enable the `pgvector` extension in the Neon console
3. Copy the connection string → set as `DATABASE_URL` in Render

### Backend + Frontend — Render

The `render.yaml` at the repo root auto-configures two services:

```bash
# Connect your GitHub repo in the Render dashboard
# → "Blueprint" → select render.yaml
# Set secrets: ANTHROPIC_API_KEY, VOYAGE_API_KEY, DATABASE_URL, ALLOWED_ORIGINS
```

After deploy:
```bash
# Load data (run once from Render shell)
python -m data.gospels_loader
alembic upgrade 002
```

### Frontend — Vercel (alternative)

```bash
cd web
vercel deploy
# Set BACKEND_INTERNAL_URL to your Render backend URL
```

### CI/CD — GitHub Actions

Push to `main` to:
1. Run backend tests (against `pgvector/pgvector:pg16` service container)
2. Typecheck + lint + build the frontend
3. Build and push Docker images to GHCR

Set repository secrets: `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`.

## What's Not Done (intentional scope)

- No real authentication — anonymous sessions only. Add NextAuth or Clerk for production.
- No chat sharing or message editing.
- No mobile-perfect responsive layout (acceptable, not pixel-perfect).
- No eval harness (Ragas) — add for production quality monitoring.
- Terraform IaC for AWS ECS/Fargate (the `render.yaml` covers the free-tier path).

## Features After Build

- Streaming chat responses token-by-token
- Inline citation chips `[MAT 5:3, WEB]` that open a verse side panel
- `/compare` — horizontally scrollable side-by-side translations
- `/passage` — passage viewer with cross-Gospel parallels and AI synthesis
- Auto-titled conversations (Claude Haiku generates a 4-word title)
- Persistent conversation history across page reloads
- Anonymous session isolation (incognito = separate session)
- Dark theme, mobile sidebar via Sheet drawer
- ⌘K / Ctrl+K keyboard shortcut for new chat
