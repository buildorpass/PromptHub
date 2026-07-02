from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.registry import list_available_models
from app.routers import folders, prompts, versions, assets, pricing, runs, test_cases, analytics

app = FastAPI(
    title="PromptHub API",
    version="1.0.0",
    description="Prompt Management & Comparison Platform — backend API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers with /api/v1 prefix
API_PREFIX = "/api/v1"
app.include_router(folders.router, prefix=API_PREFIX)
app.include_router(prompts.router, prefix=API_PREFIX)
app.include_router(versions.router, prefix=API_PREFIX)
app.include_router(assets.router, prefix=API_PREFIX)
app.include_router(pricing.router, prefix=API_PREFIX)
app.include_router(runs.router, prefix=API_PREFIX)
app.include_router(test_cases.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)


@app.get("/api/v1/models", tags=["models"])
async def get_models():
    """List all models with provider and availability status."""
    return list_available_models()


@app.get("/", tags=["health"])
async def root():
    return {"status": "ok", "service": "PromptHub API", "version": "1.0.0"}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "healthy"}
