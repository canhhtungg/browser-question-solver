from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ai_provider: str = "groq"
    groq_api_key: str | None = None
    groq_model: str = "qwen/qwen3.8-27b"
    openai_api_key: str | None = None
    openai_model: str = "gpt-5-mini"
    ai_timeout_seconds: float = 45.0
    max_request_mb: int = 8
    max_image_mb: int = 6

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def max_request_bytes(self) -> int:
        return self.max_request_mb * 1024 * 1024

    @property
    def max_image_bytes(self) -> int:
        return self.max_image_mb * 1024 * 1024

    @property
    def provider(self) -> str:
        return self.ai_provider.strip().lower()

    @property
    def model(self) -> str:
        return self.groq_model if self.provider == "groq" else self.openai_model

    @property
    def configured(self) -> bool:
        key = self.groq_api_key if self.provider == "groq" else self.openai_api_key
        return bool(key and key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
