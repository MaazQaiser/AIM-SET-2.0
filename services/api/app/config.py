from functools import lru_cache
import os
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = None if os.environ.get("DC_COPILOT_IGNORE_DOTENV") == "true" else Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    internal_secret: str = ""
    openai_api_key: str = ""
    kb_storage_bucket: str = "kb-assets"
    kb_max_upload_bytes: int = 52_428_800
    kb_embedding_model: str = "text-embedding-3-small"
    kb_worker_poll_interval_ms: int = 2000
    kb_ingest_sync: bool = False
    kb_shared_mode: bool = True
    kb_shared_tenant_key: str = "dc-copilot-shared"
    # Legacy env name; prefer OPENAI_API_KEY for all LLM + embedding calls.
    anthropic_api_key: str = ""
    content_templates_bucket: str = "content-templates"
    content_exports_bucket: str = "content-exports"
    content_studio_sync_ingest: bool = True
    recall_api_key: str = ""
    recall_region: str = "us-west-2"
    recall_bot_name: str = "DC Copilot Live Agent"
    recall_webhook_secret: str = ""
    public_api_base_url: str = ""
    jira_base_url: str = ""
    jira_api_token: str = ""
    jira_email: str = ""
    jira_project_key: str = "SALES"
    demo_transcript_replay: bool = False
    workflow_agent_on_ingest: bool = Field(
        default=True,
        validation_alias=AliasChoices("workflow_agent_on_ingest", "pre_dc_agent_on_ingest"),
    )
    # When false (default), PRE-DC Workflow runs after ingest HTTP response (avoids UI timeouts).
    workflow_agent_ingest_sync: bool = Field(
        default=False,
        validation_alias=AliasChoices("workflow_agent_ingest_sync", "pre_dc_agent_ingest_sync"),
    )
    cors_allowed_origins: str = (
        "http://localhost:3000,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3002"
    )

    @field_validator("internal_secret", mode="before")
    @classmethod
    def _strip_internal_secret(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @property
    def llm_api_key(self) -> str:
        return self.anthropic_api_key

    @property
    def llm_configured(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def anthropic_configured(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def openai_configured(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def jira_configured(self) -> bool:
        return bool(self.jira_base_url and self.jira_api_token)


@lru_cache
def get_settings() -> Settings:
    return Settings()
