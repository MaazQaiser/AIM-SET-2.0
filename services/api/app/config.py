from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    internal_secret: str = ""
    openai_api_key: str = ""
    kb_storage_bucket: str = "kb-assets"
    kb_max_upload_bytes: int = 52_428_800
    kb_embedding_model: str = "text-embedding-3-small"
    kb_worker_poll_interval_ms: int = 2000
    kb_ingest_sync: bool = False
    kb_shared_mode: bool = False
    kb_shared_tenant_key: str = "dc-copilot-shared"
    anthropic_api_key: str = ""
    content_templates_bucket: str = "content-templates"
    content_exports_bucket: str = "content-exports"
    content_studio_sync_ingest: bool = True
    recall_api_key: str = ""
    recall_webhook_secret: str = ""
    demo_transcript_replay: bool = False

    @property
    def anthropic_configured(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def openai_configured(self) -> bool:
        return bool(self.openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
