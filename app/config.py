from functools import lru_cache

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Core
    environment: str = "development"
    secret_key: str = "change-me"
    allowed_origins: str = "http://localhost:3000"

    # Database — must be set in .env (no default to avoid hardcoded credentials)
    database_url: str

    # Anthropic
    anthropic_api_key: str

    # Voyage AI (embeddings)
    voyage_api_key: str

    # Models
    embedding_model: str = "voyage-3-lite"
    embedding_dimensions: int = 512
    generation_model: str = "claude-sonnet-4-6"
    titling_model: str = "claude-haiku-4-5-20251001"

    # Retrieval
    retrieval_top_k: int = 6
    retrieval_candidates: int = 20

    # Observability (optional — Grafana Cloud or any OTLP-compatible backend)
    otel_exporter_otlp_endpoint: str = ""
    # Grafana Cloud: "Authorization=Basic <base64(instanceId:apiKey)>"
    otel_exporter_otlp_headers: str = ""
    otel_service_name: str = "gospel-rag-api"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
