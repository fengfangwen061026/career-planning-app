"""Configuration management using pydantic-settings."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# 固定指向项目根目录的 .env，与启动目录无关
# backend/app/config.py -> backend/app -> backend -> 项目根目录
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    database_url: str

    # LLM Configuration
    llm_base_url: str
    llm_api_key: str
    llm_model: str

    # Embedding Configuration
    embedding_base_url: str
    embedding_api_key: str
    embedding_model: str

    # Application
    app_name: str = "Career Planner API"
    debug: bool = False

    # File upload
    upload_dir: str = "uploads/resumes"


settings = Settings()
