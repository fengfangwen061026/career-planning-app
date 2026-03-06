"""Configuration management using pydantic-settings."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
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
