from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    deepseek_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./prompthub.db"
    debug: bool = False

    model_config = ConfigDict(env_file="../.env", extra="ignore")


settings = Settings()
