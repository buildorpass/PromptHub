# PromptHub

A full-stack prompt management and LLM comparison platform. Author prompts, version them, run them side-by-side across multiple models, track cost and quality, and organise everything into a shared team library.

**Stack:** FastAPI + SQLite (backend) · Next.js 14 App Router + shadcn/ui (frontend)

---

## Screenshots at a glance

| Page | What it does |
|---|---|
| Library | Browse all prompts in a folder tree, search by name/content/tag |
| Editor | Write prompts, save immutable versions, run against one model inline |
| Comparison | Fan-out a prompt to N models simultaneously, rate outputs side-by-side |
| Diff | Line-level diff between any two versions including variable changes |
| Test Cases | Define assertions (exact/contains/regex/manual), run, track pass/fail history |
| Assets | Reusable `{{asset:name}}` snippets injected at run time |
| Pricing | CRUD the cost table — rates drive all cost calculations at runtime |
| Analytics | Aggregated cost, latency, and quality across all runs |

---

## Prerequisites

| Tool | Minimum version |
|---|---|
| Python | 3.11 |
| Node.js | 18 |
| npm | 9 |

---

## Quick start

### 1 — Environment variables

Create (or edit) `.env` at the repo root:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
```

All keys are **optional**. Missing keys mark those models as `available: false` — the rest of the app stays fully functional.

---

### 2 — Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create the database and run migrations
alembic upgrade head

# Seed demo data (10 prompts, 7 folders, 5 assets, 9 pricing rows, 4 test cases)
python seed.py

# Start the API server
uvicorn app.main:app --reload --port 8000
```

- API: [http://localhost:8000/api/v1](http://localhost:8000/api/v1)
- Interactive docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000) (auto-redirects to `/library`)

---

## Environment variables

| Variable | Models unlocked |
|---|---|
| `OPENAI_API_KEY` | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo |
| `ANTHROPIC_API_KEY` | claude-sonnet-4-6, claude-haiku-4-5-20251001, claude-opus-4-8 |
| `DEEPSEEK_API_KEY` | deepseek-chat, deepseek-reasoner |

---

## Project layout

```
/
├── .env                        API keys (not committed)
│
├── backend/
│   ├── app/
│   │   ├── main.py             FastAPI app, CORS, router registration
│   │   ├── config.py           Pydantic Settings — reads .env
│   │   ├── database.py         Async SQLite engine, WAL mode, session factory
│   │   ├── models/orm.py       SQLAlchemy 2.0 ORM (8 tables)
│   │   ├── repositories/
│   │   │   ├── base.py         Abstract repository interfaces
│   │   │   └── sqlite.py       SQLite implementations (swap for Postgres here)
│   │   ├── schemas/            Pydantic v2 request/response models per resource
│   │   ├── routers/            FastAPI route handlers (one file per resource)
│   │   ├── adapters/
│   │   │   ├── base.py         BaseLLMAdapter + LLMResponse dataclass
│   │   │   ├── openai_adapter.py
│   │   │   ├── anthropic_adapter.py
│   │   │   ├── deepseek_adapter.py
│   │   │   └── registry.py     Model → adapter map, asset resolution, cost calc
│   │   └── services/
│   │       └── runner.py       Async fan-out logic (asyncio.gather)
│   ├── alembic/                DB migrations (001 initial, 002 passed column)
│   ├── seed.py                 Demo data seeder
│   ├── requirements.txt
│   └── README.md
│
└── frontend/
    └── src/
        ├── app/                Next.js App Router pages
        │   ├── library/        Folder tree + prompt list
        │   ├── editor/[id]/    Version editor + inline run panel
        │   ├── editor/[id]/diff/   Version diff viewer
        │   ├── comparison/     Multi-model side-by-side runner
        │   ├── test-cases/     Test case CRUD + run history
        │   ├── assets/         Asset manager
        │   ├── pricing/        Model pricing CRUD
        │   └── analytics/      Cost & efficiency dashboard
        ├── components/
        │   ├── ui/             Button, Input, Dialog, Sheet, Table, Tabs, Toast...
        │   └── shared/         ModelBadge, CostDisplay, TokenCount, PageHeader...
        ├── hooks/              TanStack Query hooks per resource
        ├── lib/                api.ts, queryClient.ts, utils.ts
        └── types/index.ts      TypeScript interfaces matching backend schemas
```

---

## API reference

Base URL: `http://localhost:8000/api/v1`

Paginated list endpoints accept `?page=1&page_size=20` and return `{ items, total, page, page_size }`.  
Exceptions that return plain arrays (not paginated): `GET /models`, `GET /prompts/{id}/versions`, `GET /test-cases/{id}/history`.

### Models
| Method | Path | Notes |
|---|---|---|
| GET | `/models` | All known models with `available: bool` |

### Folders
| Method | Path | Notes |
|---|---|---|
| GET | `/folders` | Paginated list |
| GET | `/folders/tree` | Full nested hierarchy with prompt counts |
| POST | `/folders` | `{ name, parent_id?, team_shared? }` |
| GET | `/folders/{id}` | |
| PUT | `/folders/{id}` | |
| DELETE | `/folders/{id}` | |

### Prompts
| Method | Path | Notes |
|---|---|---|
| GET | `/prompts` | `?search=&folder_id=&tags=` |
| GET | `/prompts/tags` | Unique tag list across all prompts |
| POST | `/prompts` | Creates prompt + first version atomically |
| GET | `/prompts/{id}` | Includes `latest_version_number` |
| PUT | `/prompts/{id}` | Metadata only (name, description, folder, tags) |
| DELETE | `/prompts/{id}` | |

### Versions
| Method | Path | Notes |
|---|---|---|
| GET | `/prompts/{id}/versions` | Plain array, ordered by version number |
| POST | `/prompts/{id}/versions` | Immutable — creates new row, never mutates |
| GET | `/prompts/{id}/versions/{vid}` | |
| GET | `/prompts/{id}/versions/diff?v1={id}&v2={id}` | Structured line-level diff |
| POST | `/prompts/{id}/versions/{vid}/restore` | Copies old version content into new row |

### Runs
| Method | Path | Notes |
|---|---|---|
| POST | `/runs` | `{ prompt_version_id, model_names[], variable_inputs? }` — fans out concurrently |
| GET | `/runs` | Paginated recent runs |
| GET | `/runs/{id}` | Run + all `RunResult` rows |
| POST | `/runs/results/{id}/rate` | `{ rating: 1-5, tag? }` |

### Test Cases
| Method | Path | Notes |
|---|---|---|
| GET | `/test-cases` | Paginated |
| POST | `/test-cases` | `{ name, prompt_version_id, variable_inputs?, assertion_type?, assertion_value? }` |
| GET | `/test-cases/{id}` | |
| PUT | `/test-cases/{id}` | |
| DELETE | `/test-cases/{id}` | |
| POST | `/test-cases/{id}/run` | `{ model_names[] }` — evaluates assertions per result |
| GET | `/test-cases/{id}/history` | Plain array of runs with pass/fail counts |

### Assets
| Method | Path | Notes |
|---|---|---|
| GET | `/assets` | `?search=&type=` |
| POST | `/assets` | `{ name, content, type, team_shared? }` — `name` becomes `{{asset:name}}` token |
| GET | `/assets/{id}` | |
| PUT | `/assets/{id}` | |
| DELETE | `/assets/{id}` | |

### Pricing
| Method | Path | Notes |
|---|---|---|
| GET | `/pricing` | All model pricing rows |
| POST | `/pricing` | `{ provider, model_name, input_rate, output_rate, currency? }` |
| PUT | `/pricing/{id}` | |
| DELETE | `/pricing/{id}` | |

> Rates are **$ per 1,000 tokens**. These drive all cost calculations at runtime — never hardcoded in application code.

### Analytics
| Method | Path | Returns |
|---|---|---|
| GET | `/analytics/summary` | Total prompts, runs, cost, models used |
| GET | `/analytics/cost-by-model` | Cost + token aggregates per model |
| GET | `/analytics/cost-by-prompt` | Cost aggregates per prompt |
| GET | `/analytics/efficiency` | Avg latency, cost, rating per model |
| GET | `/analytics/recent-runs` | Last N runs (`?limit=20`) with prompt + model context |

---

## How to add a model

### Existing provider (e.g. a new OpenAI model)

1. Add the model string to `OPENAI_MODELS` in `backend/app/adapters/openai_adapter.py`
2. Register it in `_MODEL_MAP` in `backend/app/adapters/registry.py`
3. Add a pricing row via `POST /api/v1/pricing` or the Pricing page in the UI

### New provider

1. Create `backend/app/adapters/<provider>_adapter.py` implementing `BaseLLMAdapter`:
   ```python
   class MyAdapter(BaseLLMAdapter):
       async def complete(self, prompt, system_prompt, model, max_tokens, temperature) -> LLMResponse: ...
       @property
       def provider(self) -> str: return "myprovider"
       def supported_models(self) -> list[str]: return ["my-model-v1"]
   ```
2. Register in `registry.py` `_MODEL_MAP` and `_key_available()`
3. Add `MYPROVIDER_API_KEY` to `.env` and `app/config.py`
4. Add pricing rows via the UI

---

## Architecture decisions

### Repository pattern
All DB access goes through abstract interfaces in `repositories/base.py`. The `sqlite.py` module provides the concrete implementations. To migrate to Postgres, implement the same interfaces targeting `asyncpg` — no routers or business logic change.

### WAL mode
SQLite is opened in Write-Ahead Logging mode on every connection (via SQLAlchemy `@event.listens_for`). This allows concurrent reads alongside writes. A 5-second busy timeout queues writers instead of failing immediately.

### Immutable versions
`PromptVersion` rows are **never updated**. `VersionRepository.update()` raises `NotImplementedError`. Every content change inserts a new row with an auto-incremented `version_number`. Restoring an old version creates a new version row that copies its content.

### Cost at runtime
Cost = `(input_tokens × input_rate / 1000) + (output_tokens × output_rate / 1000)`. Rates are always read from the `model_pricing` table at the time of the run. If no row exists for a model, `cost` is stored as `null`. Prices are never hardcoded.

### Template resolution order
At run time, before calling the LLM:
1. `{{asset:name}}` tokens are batch-fetched from the DB and replaced inline
2. `{{variable_name}}` tokens are replaced from the user-supplied `variable_inputs` dict
3. Unresolved tokens are left as-is with a warning log

### Async fan-out
`POST /runs` with multiple `model_names` calls all adapters concurrently via `asyncio.gather(..., return_exceptions=True)`. One model failing never aborts the others — errors are captured as `RunResult` rows with the `error` field set and `output_text = null`.

### Auth stub
User identity comes from the `X-User-Id` request header (`dev-user` by default). To add real auth, inject a JWT/session middleware in `app/main.py` and populate the header — no router changes needed.

---

## Seed data

`python seed.py` clears existing data and creates:

| Entity | Count | Details |
|---|---|---|
| Folders | 7 | Marketing, Engineering, Sales, HR & People, Operations + Social Media + Dev Tools sub-folders |
| Prompts | 10 | 2–3 versions each, covering sales, engineering, marketing, HR, ops use cases |
| Assets | 5 | `json_output_format`, `professional_tone`, `friendly_casual_tone`, `chain_of_thought`, `safety_disclaimer` |
| Pricing rows | 9 | OpenAI ×4, Anthropic ×3, DeepSeek ×2 — **placeholder values, update before use** |
| Test cases | 4 | Email outreach, SQL generation, sentiment classification, meeting summary |

---

## Development tips

- **Re-seed at any time:** `python seed.py` (clears and repopulates)
- **Reset the DB entirely:** delete `backend/prompthub.db`, then `alembic upgrade head && python seed.py`
- **API explorer:** [http://localhost:8000/docs](http://localhost:8000/docs) — all endpoints are interactive
- **Hot reload:** both `uvicorn --reload` and `next dev` watch for file changes
- **CORS:** fully open in dev (`allow_origins=["*"]`). Restrict in production.
"# PromptHub" 
"# PromptHub" 
"# PromptHub" 
"# PromptHub" 
"# PromptHub" 
"# PromptHub" 
