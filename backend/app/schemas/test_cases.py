import json
from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.runs import RunResultResponse


class TestCaseCreate(BaseModel):
    name: str
    prompt_version_id: int
    variable_inputs: Optional[Dict[str, str]] = None
    assertion_type: Optional[str] = None  # exact, contains, regex, manual
    assertion_value: Optional[str] = None


class TestCaseUpdate(BaseModel):
    name: Optional[str] = None
    variable_inputs: Optional[Dict[str, str]] = None
    assertion_type: Optional[str] = None
    assertion_value: Optional[str] = None


class TestCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    prompt_version_id: int
    variable_inputs: Optional[Dict[str, str]] = None
    assertion_type: Optional[str]
    assertion_value: Optional[str]
    created_at: datetime

    @field_validator("variable_inputs", mode="before")
    @classmethod
    def parse_variable_inputs(cls, v: Any) -> Optional[Dict[str, str]]:
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return None
        return None


class TestCaseRunRequest(BaseModel):
    model_names: List[str]


class TestCaseRunResponse(BaseModel):
    run_id: int
    status: str
    results: List[RunResultResponse]


class TestCaseHistoryItem(BaseModel):
    id: int
    created_at: datetime
    status: str
    model_count: int
    pass_count: int
    fail_count: int
