from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PricingCreate(BaseModel):
    provider: str
    model_name: str
    input_rate: float   # $ per 1K input tokens
    output_rate: float  # $ per 1K output tokens
    currency: str = "USD"


class PricingUpdate(BaseModel):
    provider: Optional[str] = None
    model_name: Optional[str] = None
    input_rate: Optional[float] = None
    output_rate: Optional[float] = None
    currency: Optional[str] = None


class PricingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: str
    model_name: str
    input_rate: float
    output_rate: float
    currency: str
    updated_at: datetime
