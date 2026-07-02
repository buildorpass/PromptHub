from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AssetCreate(BaseModel):
    name: str
    content: str
    type: str = "snippet"
    team_shared: bool = False
    owner: str = "default"


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    type: Optional[str] = None
    team_shared: Optional[bool] = None


class AssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    content: str
    type: str
    team_shared: bool
    owner: str
    created_at: datetime
    updated_at: datetime
