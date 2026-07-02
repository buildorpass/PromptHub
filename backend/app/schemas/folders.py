from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None
    team_shared: bool = False


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    team_shared: Optional[bool] = None


class FolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    parent_id: Optional[int]
    team_shared: bool
    created_at: datetime
