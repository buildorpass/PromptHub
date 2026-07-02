# PromptHub — Backend

FastAPI + SQLite backend for the PromptHub prompt management platform.

## Prerequisites

- Python 3.11+

## Setup

```bash
# From the backend/ directory:

python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

## Database

```bash
# Create tables (runs all Alembic migrations)
alembic upgrade head

# Populate with demo data
python seed.py
```

The database file is created at `backend/prompthub.db`. To reset: delete it and re-run the two commands above.

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

- API base: http://localhost:8000/api/v1
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Environment variables

Place in `.env` at the **repo root** (`../. env` relative to this directory):

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
```

Missing keys do not crash the server — the corresponding models are marked `available: false` in `GET /api/v1/models` and return HTTP 400 if a run is attempted.

## Project structure

```
app/
├── main.py             FastAPI app, CORS middleware, router registration
├── config.py           Pydantic BaseSettings — reads .env
├── database.py         Async SQLite engine, WAL mode pragma, session factory
│
├── models/
│   └── orm.py          SQLAlchemy 2.0 declarative models (8 tables)
│
├── repositories/
│   ├── base.py         Abstract interfaces for all repositories
│   └── sqlite.py       Concrete async SQLite implementations
│
├── schemas/            Pydantic v2 schemas per resource
│   ├── prompts.py
│   ├── versions.py
│   ├── folders.py
│   ├── assets.py
│   ├── pricing.py
│   ├── runs.py
│   ├── test_cases.py
│   └── analytics.py
│
├── routers/            FastAPI route handlers
│   ├── prompts.py
│   ├── versions.py
│   ├── folders.py
│   ├── assets.py
│   ├── pricing.py
│   ├── runs.py
│   ├── test_cases.py
│   └── analytics.py
│
├── adapters/           LLM provider integrations
│   ├── base.py         BaseLLMAdapter ABC + LLMResponse dataclass
│   ├── openai_adapter.py
│   ├── anthropic_adapter.py
│   ├── deepseek_adapter.py
│   └── registry.py     Model → adapter map; asset/variable resolution; cost calc
│
└── services/
    └── runner.py       Async multi-model fan-out (asyncio.gather)

alembic/
├── env.py
└── versions/
    ├── 001_initial.py      All 8 tables
    └── 002_add_passed_to_run_results.py

seed.py                 Clears DB and inserts demo data
requirements.txt
```

## Data model

| Table | Key design |
|---|---|
| `folders` | Self-referential `parent_id` for nesting |
| `prompts` | Metadata only; all content lives in `prompt_versions` |
| `prompt_versions` | **Immutable** — `update()` raises `NotImplementedError` |
| `model_pricing` | Unique on `model_name`; rates in $/1K tokens |
| `test_runs` | Status: `pending → running → completed / failed` |
| `run_results` | One row per model per run; `passed` is nullable (manual review = null) |
| `assets` | Unique on `name`; referenced in prompts as `{{asset:name}}` |
| `test_cases` | `assertion_type`: `exact \| contains \| regex \| manual` |

## Adding a model

### New model, existing provider

1. Add the model string to the provider's `*_MODELS` list (e.g. `OPENAI_MODELS` in `openai_adapter.py`)
2. Add it to `_MODEL_MAP` in `registry.py`
3. Add a pricing row via `POST /api/v1/pricing`

### New provider entirely

1. Create `app/adapters/<provider>_adapter.py`:

```python
from app.adapters.base import BaseLLMAdapter, LLMResponse

MY_MODELS = ["my-model-v1"]

class MyAdapter(BaseLLMAdapter):
    async def complete(self, prompt, system_prompt, model, max_tokens=2048, temperature=0.7) -> LLMResponse:
        # call provider API, return LLMResponse(output_text, input_tokens, output_tokens, latency_ms)
        ...

    @property
    def provider(self) -> str:
        return "myprovider"

    def supported_models(self) -> list[str]:
        return MY_MODELS
```

2. Register in `registry.py`:
   ```python
   from app.adapters.my_adapter import MyAdapter, MY_MODELS
   _my_adapter = MyAdapter()
   for m in MY_MODELS:
       _MODEL_MAP[m] = _my_adapter
   # Add to _key_available():
   "myprovider": settings.myprovider_api_key,
   ```

3. Add `myprovider_api_key: str = ""` to `app/config.py` Settings
4. Set `MYPROVIDER_API_KEY=...` in `.env`
5. Add pricing rows via `POST /api/v1/pricing`

## Key architectural constraints

**Repository pattern** — Routers never import SQLAlchemy directly. All queries go through repository classes. To swap Postgres: implement the same abstract interfaces in a new file and inject them.

**WAL mode** — Set via `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000` on every new connection. Concurrent reads are never blocked by writes.

**Immutable versions** — Never call `UPDATE` on `prompt_versions`. The `restore` endpoint copies an old version's content into a brand-new row.

**Pricing at runtime** — Cost is computed on every run from the `model_pricing` table. Zero hardcoded rates in application code.

**Template resolution order:**
1. `{{asset:name}}` — batch DB lookup, replaced inline
2. `{{variable_name}}` — replaced from `variable_inputs` dict
3. Unresolved tokens — logged as warnings, left in place

**Fan-out** — `asyncio.gather(*calls, return_exceptions=True)` ensures one failing model never aborts others. Exceptions become `RunResult` rows with `error` set.

## API endpoints

All list endpoints: `?page=1&page_size=20` → `{ items, total, page, page_size }`

Exceptions returning plain arrays: `GET /models`, `GET /prompts/{id}/versions`, `GET /test-cases/{id}/history`

```
GET    /api/v1/models

GET    /api/v1/folders
GET    /api/v1/folders/tree
POST   /api/v1/folders
GET    /api/v1/folders/{id}
PUT    /api/v1/folders/{id}
DELETE /api/v1/folders/{id}

GET    /api/v1/prompts              ?search= &folder_id= &tags=
GET    /api/v1/prompts/tags
POST   /api/v1/prompts
GET    /api/v1/prompts/{id}
PUT    /api/v1/prompts/{id}         metadata only (name, description, folder, tags)
DELETE /api/v1/prompts/{id}

GET    /api/v1/prompts/{id}/versions
POST   /api/v1/prompts/{id}/versions
GET    /api/v1/prompts/{id}/versions/diff   ?v1={id}&v2={id}
GET    /api/v1/prompts/{id}/versions/{vid}
POST   /api/v1/prompts/{id}/versions/{vid}/restore

POST   /api/v1/runs                 { prompt_version_id, model_names[], variable_inputs? }
GET    /api/v1/runs
GET    /api/v1/runs/{id}
POST   /api/v1/runs/results/{id}/rate

GET    /api/v1/test-cases
POST   /api/v1/test-cases
GET    /api/v1/test-cases/{id}
PUT    /api/v1/test-cases/{id}
DELETE /api/v1/test-cases/{id}
POST   /api/v1/test-cases/{id}/run         { model_names[] }
GET    /api/v1/test-cases/{id}/history

GET    /api/v1/assets               ?search= &type=
POST   /api/v1/assets
GET    /api/v1/assets/{id}
PUT    /api/v1/assets/{id}
DELETE /api/v1/assets/{id}

GET    /api/v1/pricing
POST   /api/v1/pricing
PUT    /api/v1/pricing/{id}
DELETE /api/v1/pricing/{id}

GET    /api/v1/analytics/summary
GET    /api/v1/analytics/cost-by-model
GET    /api/v1/analytics/cost-by-prompt
GET    /api/v1/analytics/efficiency
GET    /api/v1/analytics/recent-runs        ?limit=20
```
