"""Configuration management using pydantic-settings."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# 项目根目录 .env（backend/app/config.py 上溯三级）
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/career_planner"

    # LLM Configuration
    llm_base_url: str = "https://api.minimax.chat/v1"
    llm_api_key: str = ""
    llm_model: str = "default-model"

    # Embedding Configuration
    embedding_base_url: str = "https://api.minimax.chat/v1"
    embedding_api_key: str = ""
    embedding_model: str = "default-embedding-model"

    # Application
    app_name: str = "Career Planner API"
    debug: bool = False

    # File upload
    upload_dir: str = "uploads/resumes"


settings = Settings()
