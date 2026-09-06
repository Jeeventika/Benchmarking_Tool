# Decision Support Tool

A research assistant that helps compare options (AI models, research papers,
colleges, products, etc.) using evidence from sources, and shows how
comparable and reliable that evidence is — so the user can make an
informed decision. The system's judgment is always secondary to the
user's own judgment.

## Status: Phase 1 — Scaffold

This phase sets up empty-but-runnable frontend and backend projects, plus
the database schema. No business logic (evidence gathering, comparability
checks, recommendations) is implemented yet — that starts in Phase 3.

## Project structure

```
decision-support-tool/
├── frontend/   React + Vite + Tailwind CSS
├── backend/    Node.js + Express API
└── README.md
```

Architecture: `Frontend → Backend API → PostgreSQL (+ Ollama for AI analysis, backend-only)`.
The frontend never talks to Postgres or Ollama directly.

## Prerequisites

- Node.js 18+
- PostgreSQL running locally (or accessible via `DB_HOST` etc.)
- [Ollama](https://ollama.com) running locally (only needed from Phase 4 onward)

## Setup

### 1. Database

Create the database, then run the migration:

```bash
createdb decision_support
cd backend
cp .env.example .env   # adjust DB credentials if needed
npm install
npm run migrate
```

### 2. Backend

```bash
cd backend
npm install    # if not already done
npm run dev    # starts on http://localhost:4000
```

Check it's alive:

```bash
curl http://localhost:4000/api/health
# {"status":"ok","db":"connected"}
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev    # starts on http://localhost:5173
```

Open http://localhost:5173 — you should see the nav bar and placeholder
Home page. API calls from the frontend to `/api/...` are proxied to the
backend on port 4000.

## What exists right now

- Working Vite + React + Tailwind frontend shell with routing for all 7
  pages (Home, Start Comparison, Research, Results, Analysis,
  Recommendation, Decision) — each is currently a placeholder.
- Working Express backend with a `/api/health` check, a real
  `comparisons` route (create/list, writes to Postgres), and stubbed
  routes for evidence/recommendations (501 until Phase 3) and decisions
  (fully working — writes to the `decisions` table).
- Full Postgres schema (`backend/src/db/migrations/001_init.sql`)
  covering comparisons, items, evidence, comparability checks, analyses,
  recommendations, and decisions.
- An Ollama service stub (backend-only, never called from the frontend).

## Next phase

Phase 2: seed the database with one complete realistic mock comparison
scenario (e.g. two colleges compared on cost and reputation) covering
every evidence field.
