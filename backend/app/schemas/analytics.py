from typing import Optional, List

from pydantic import BaseModel


class CostByModelItem(BaseModel):
    model_name: str
    provider: Optional[str] = None
    total_runs: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost: float
    avg_cost_per_run: float
    avg_latency_ms: float


class CostByPromptItem(BaseModel):
    prompt_id: int
    prompt_name: str
    version_count: int
    total_runs: int
    total_cost: float


class EfficiencyItem(BaseModel):
    model_name: str
    provider: Optional[str] = None
    avg_latency_ms: float
    avg_cost_per_run: float
    avg_rating: Optional[float] = None
    total_rated: int
    total_runs: int


class RecentRunItem(BaseModel):
    run_id: int
    prompt_name: str
    model_name: str
    cost: Optional[float] = None
    latency_ms: Optional[int] = None
    rating: Optional[int] = None
    status: str
    error: Optional[str] = None
    created_at: str


class AnalyticsSummary(BaseModel):
    total_prompts: int
    total_runs: int
    total_cost: float
    total_models_used: int
