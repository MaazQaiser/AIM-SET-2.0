from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class PreDCRecordIn(BaseModel):
    id: str
    fields: Dict[str, str]


class PostDCRecordIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    fields: Dict[str, str]
    matched_call_id: Optional[str] = Field(default=None, alias="matchedCallId")


class IngestRequest(BaseModel):
    kind: Literal["pre-dc", "post-dc"]
    records: List[Dict[str, Any]]


class PreDcAgentInput(BaseModel):
    record: PreDCRecordIn
    call_id: str = Field(alias="callId")
    trigger: Literal["ingest", "manual"] = "ingest"

    model_config = ConfigDict(populate_by_name=True)


class IngestResponse(BaseModel):
    upserted: int
    kind: Literal["pre-dc", "post-dc"]
    agent_processed: int = 0
    agent_queued: int = 0


class PreDCRecordOut(BaseModel):
    id: str
    fields: Dict[str, str]


class PostDCRecordOut(BaseModel):
    id: str
    fields: Dict[str, str]
    matchedCallId: Optional[str] = None


class DcNotesResponse(BaseModel):
    pre_dc_records: List[PreDCRecordOut]
    post_dc_records: List[PostDCRecordOut]


def row_to_pre_record(row: Dict[str, Any]) -> PreDCRecordOut:
    fields = row.get("fields") or {}
    if not isinstance(fields, dict):
        fields = {}
    return PreDCRecordOut(
        id=str(row["id"]),
        fields={str(k): str(v) for k, v in fields.items()},
    )


class CopilotHistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class CopilotChatIn(BaseModel):
    message: str
    history: List[CopilotHistoryTurn] = Field(default_factory=list)
    call_id: Optional[str] = Field(default=None, alias="callId")
    surface: Literal[
        "home",
        "pre_dc",
        "live_dc",
        "post_dc",
        "knowledge",
        "content",
        "agents",
        "settings",
        "global",
    ] = "global"
    context: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True)


class CopilotActionTaken(BaseModel):
    tool: Optional[str] = None
    agent: Optional[str] = None
    call_id: Optional[str] = Field(default=None, alias="callId")
    status: Optional[str] = None
    summary: Optional[str] = None
    export: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(extra="allow", populate_by_name=True)


class CopilotCitationOut(BaseModel):
    source_type: str = "kb_document"
    source_id: str = ""
    snippet: str = ""
    confidence: float = 0.8


class CopilotChatResponse(BaseModel):
    answer: str
    message_id: str
    citations: List[CopilotCitationOut] = Field(default_factory=list)
    actions_taken: List[Dict[str, Any]] = Field(default_factory=list)
    call_exports: List[Dict[str, Any]] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    confidence: float = 0.0
    missing_evidence: List[str] = Field(default_factory=list)


def row_to_post_record(row: Dict[str, Any]) -> PostDCRecordOut:
    fields = row.get("fields") or {}
    if not isinstance(fields, dict):
        fields = {}
    matched = row.get("matched_call_id")
    return PostDCRecordOut(
        id=str(row["id"]),
        fields={str(k): str(v) for k, v in fields.items()},
        matchedCallId=str(matched) if matched else None,
    )
