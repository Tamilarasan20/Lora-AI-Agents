"""Centralised settings, loaded from env."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ────────────────────────────────────────────────
    env: str = "development"
    log_level: str = "info"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ── LLM provider keys ──────────────────────────────────
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    gemini_api_key: str | None = None
    openrouter_api_key: str | None = None

    # ── Supabase (auth + Postgres) ─────────────────────────
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    database_url: str | None = None

    # ── Router defaults ────────────────────────────────────
    default_cost_tier: str = "cheap"  # cheap | balanced | premium
    enable_router_telemetry: bool = True


settings = Settings()
