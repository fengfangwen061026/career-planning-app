"""Configuration management using pydantic-settings."""
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# 固定指向项目根目录的 .env，与启动目录无关
# backend/app/config.py -> backend/app -> backend -> 项目根目录
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def _normalize_stepfun_base_url(value: str | None) -> str | None:
    if not value:
        return value

    parsed = urlsplit(value.strip())
    if parsed.netloc != "api.stepfun.com":
        return value.strip().rstrip("/")

    normalized_path = parsed.path.rstrip("/")
    if normalized_path == "/step_plan/v1":
        return urlunsplit((parsed.scheme, parsed.netloc, "/v1", parsed.query, parsed.fragment))

    return value.strip().rstrip("/")


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
    profile_llm_base_url: str | None = None
    profile_llm_api_key: str | None = None
    profile_llm_model: str | None = None
    resume_parse_llm_model: str | None = None

    # Embedding Configuration
    embedding_base_url: str
    embedding_api_key: str
    embedding_model: str

    # LLM Concurrency Control
    llm_concurrent_limit: int = 10

    # Application
    app_name: str = "Career Planner API"
    debug: bool = False

    # File upload
    upload_dir: str = "uploads/resumes"

    @field_validator("llm_base_url", "profile_llm_base_url", mode="before")
    @classmethod
    def normalize_stepfun_urls(cls, value: str | None) -> str | None:
        return _normalize_stepfun_base_url(value)


settings = Settings()
