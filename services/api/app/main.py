from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Dict

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

# Repo-root python-packages (dc_core, dc_llm, dc_tools)
_REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_REPO_ROOT / "python-packages"))

if os.environ.get("DC_COPILOT_IGNORE_DOTENV") != "true":
    load_dotenv()

from app.routers import (  # noqa: E402
    dc_notes,
    v1_agents,
    v1_calls,
    v1_content_studio,
    v1_copilot,
    v1_integrations_jira,
    v1_kb,
    v1_workflow,
    v1_webhooks,
    websocket,
)

app = FastAPI(title="DC Copilot API", version="0.2.0")

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dc_notes.router)
app.include_router(v1_calls.router)
app.include_router(v1_copilot.router)
app.include_router(v1_workflow.router)
app.include_router(v1_kb.router)
app.include_router(v1_content_studio.router)
app.include_router(v1_agents.router)
app.include_router(v1_integrations_jira.router)
app.include_router(v1_webhooks.router)
app.include_router(websocket.router)


@app.get("/health")
def health() -> Dict[str, object]:
    settings = get_settings()
    return {
        "status": "ok",
        "supabase_configured": settings.supabase_configured,
        "openai_configured": settings.openai_configured,
        "kb_ingest_sync": settings.kb_ingest_sync,
        "kb_shared_mode": settings.kb_shared_mode,
    }
