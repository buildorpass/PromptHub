import json
from datetime import datetime
from typing import Optional, List, Any, Dict

from pydantic import BaseModel, ConfigDict, field_validator


class VersionCreate(BaseModel):
    content: str
    system_prompt: Optional[str] = None
    variables: Optional[Dict[str, str]] = None  # {"var_name": "description"}
    commit_message: str
    author: str = "default"


class VersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    prompt_id: int
    version_number: int
    content: str
    system_prompt: Optional[str]
    variables: Optional[Dict[str, str]] = None
    commit_message: str
    author: str
    created_at: datetime

    @field_validator("variables", mode="before")
    @classmethod
    def parse_variables(cls, v: Any) -> Optional[Dict[str, str]]:
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


class DiffHunk(BaseModel):
    line_number_old: Optional[int]
    line_number_new: Optional[int]
    operation: str  # "equal", "insert", "delete", "replace"
    old_text: Optional[str] = None
    new_text: Optional[str] = None


class VersionDiff(BaseModel):
    v1: VersionResponse
    v2: VersionResponse
    content_diff: List[DiffHunk]
    variables_diff: List[DiffHunk]
