from datetime import datetime
from typing import Optional, Dict, List

from pydantic import BaseModel, ConfigDict


class RunCreate(BaseModel):
    prompt_version_id: int
    model_names: List[str]
    variable_inputs: Optional[Dict[str, str]] = None
    max_tokens: int = 2048
    temperature: float = 0.7


class RateResult(BaseModel):
    rating: int  # 1-5
    tag: Optional[str] = None


class RunResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    test_run_id: int
    model_name: str
    output_text: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cost: Optional[float] = None
    latency_ms: Optional[int] = None
    error: Optional[str] = None
    rating: Optional[int] = None
    rating_tag: Optional[str] = None
    passed: Optional[bool] = None
    created_at: datetime


class RunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    prompt_version_id: int
    status: str
    created_at: datetime
    results: List[RunResultResponse] = []
