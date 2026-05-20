from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Repo-root python-packages (dc_core, dc_llm, dc_tools)
_REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_REPO_ROOT / "python-packages"))

load_dotenv()

from app.routers import dc_notes, v1_agents, v1_calls, v1_content_studio, v1_kb, websocket  # noqa: E402

app = FastAPI(title="DC Copilot API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dc_notes.router)
app.include_router(v1_calls.router)
app.include_router(v1_kb.router)
app.include_router(v1_content_studio.router)
app.include_router(v1_agents.router)
app.include_router(websocket.router)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}
