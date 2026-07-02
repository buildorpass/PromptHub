import json
from datetime import datetime
from typing import Optional, List, Any

from pydantic import BaseModel, ConfigDict, field_validator


class PromptCreate(BaseModel):
    name: str
    description: Optional[str] = None
    folder_id: Optional[int] = None
    owner: str = "default"
    tags: Optional[List[str]] = None
    # First version fields
    content: str
    system_prompt: Optional[str] = None
    variables: Optional[dict] = None
    commit_message: str = "Initial version"
    author: str = "default"


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    folder_id: Optional[int] = None
    tags: Optional[List[str]] = None


class PromptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    folder_id: Optional[int]
    owner: str
    tags: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    latest_version_number: Optional[int] = None

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v: Any) -> Optional[List[str]]:
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, ValueError):
                pass
            return [v]
        return None
