# Prompt templates package

from app.ai.prompts.job_profile import build_job_profile_prompt
from app.ai.prompts.report import (
    build_chapter_content_prompt,
    build_completeness_prompt,
    build_outline_prompt,
    build_polish_prompt,
)
__all__ = [
    "build_job_profile_prompt",
    "build_outline_prompt",
    "build_chapter_content_prompt",
    "build_polish_prompt",
    "build_completeness_prompt",
]
