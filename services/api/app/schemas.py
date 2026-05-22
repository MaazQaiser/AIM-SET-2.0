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
