from __future__ import annotations

import csv
import hashlib
import html
import io
import re
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from dc_core.tenancy import TenantContext

from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant

PROJECT_TITLE_KEYS = (
    "project name",
    "project",
    "case study",
    "customer project",
    "client project",
    "opportunity name",
    "name",
    "title",
)

COMPANY_KEYS = (
    "company name",
    "account name",
    "company",
    "client name",
    "client",
    "customer",
)

IMPORTANT_FIELDS = {
    "problemStatement": ("problem statement", "problem", "challenge"),
    "businessOutcome": ("business outcome completed by ae", "business outcome", "outcome"),
    "functionalSolution": ("functional solution", "solution overview"),
    "technicalSolution": ("technical solution", "technical approach"),
    "industry": ("linkedin industry", "industry"),
    "sector": ("linkedin category / sector", "category", "sector"),
    "domain": ("domain",),
    "subDomain": ("sub domain", "subdomain"),
    "companyStage": ("company stage", "company stage test", "stage"),
    "startDate": ("project actual start date", "actual start date", "start date"),
    "endDate": ("project agreed end date", "agreed end date", "end date"),
    "definitionsUrl": ("definitions & examples", "definitions and examples", "examples"),
}

PROJECT_ASSET_HINTS = ("project", "sale enablement")
PROJECT_CACHE_TTL_SECONDS = 60
_PROJECT_CACHE: Dict[str, Tuple[float, Tuple[str, ...], List[Dict[str, Any]]]] = {}


def _norm_key(value: str) -> str:
    return " ".join(value.replace("_", " ").replace("-", " ").strip().lower().split())


def _clean_text(value: Any) -> str:
    text = str(value or "").replace("\ufeff", "").replace("\u00a0", " ").strip()
    if not text or text.upper() in {"N/A", "NA", "NONE", "NULL", "-"}:
        return ""
    text = html.unescape(text)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\\n", "\n")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _field_lookup(fields: Dict[str, Any], keys: Iterable[str]) -> str:
    normalized = {_norm_key(k): _clean_text(v) for k, v in fields.items()}
    for key in keys:
        value = normalized.get(_norm_key(key))
        if value:
            return value
    return ""


def _decode_csv(file_bytes: bytes) -> str:
    errors: List[str] = []
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError as exc:
            errors.append(f"{encoding}: {exc}")
    raise UnicodeDecodeError("utf-8", file_bytes, 0, 1, "; ".join(errors))


def _parse_csv_rows(file_bytes: bytes) -> List[Dict[str, str]]:
    text = _decode_csv(file_bytes)
    if not text.strip():
        return []

    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample)
    except csv.Error:
        dialect = csv.excel

    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    rows: List[Dict[str, str]] = []
    for row in reader:
        cleaned = {
            _clean_text(key): _clean_text(value)
            for key, value in (row or {}).items()
            if _clean_text(key) and _clean_text(value)
        }
        if cleaned:
            rows.append(cleaned)
    return rows


def _parse_field_line(line: str) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    for part in line.split(";"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        key = _clean_text(key)
        value = _clean_text(value)
        if key and value:
            fields[key] = value
    return fields


def _parse_chunk_rows(chunks: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for chunk in sorted(chunks, key=lambda c: int(c.get("chunk_index") or 0)):
        text = str(chunk.get("chunk_text") or "")
        for line in text.splitlines():
            fields = _parse_field_line(line)
            if fields:
                rows.append(fields)
        if not rows:
            fields = _parse_field_line(text)
            if fields:
                rows.append(fields)
    return rows


def _asset_is_projectish(asset: Dict[str, Any]) -> bool:
    haystack = " ".join(
        [
            str(asset.get("title") or ""),
            str(asset.get("fileName") or ""),
            str(asset.get("file_name") or ""),
            str(asset.get("type") or ""),
            " ".join(str(tag) for tag in asset.get("tags") or []),
        ]
    ).lower()
    return any(hint in haystack for hint in PROJECT_ASSET_HINTS)


def _is_csv_asset(asset: Dict[str, Any]) -> bool:
    file_name = str(asset.get("fileName") or asset.get("file_name") or "")
    mime = str(asset.get("mimeType") or asset.get("mime_type") or "").lower()
    return Path(file_name).suffix.lower() == ".csv" or "csv" in mime


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:72] or "project"


def _project_id(company: str, title: str) -> str:
    raw = f"{company.lower()}::{title.lower()}".encode("utf-8")
    return f"kbproj-{_slug(title)}-{hashlib.sha1(raw).hexdigest()[:10]}"


def _compact(value: str, limit: int = 260) -> str:
    text = re.sub(r"\s+", " ", value).strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3].rstrip()}..."


def _row_to_project(
    fields: Dict[str, str],
    *,
    asset: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    company = _field_lookup(fields, COMPANY_KEYS)
    project_name = _field_lookup(fields, PROJECT_TITLE_KEYS)
    title = project_name or company
    if not title:
        return None

    normalized_fields = {key: _clean_text(value) for key, value in fields.items() if _clean_text(value)}
    if len(normalized_fields) <= 1:
        return None

    important = {
        api_key: _field_lookup(normalized_fields, source_keys)
        for api_key, source_keys in IMPORTANT_FIELDS.items()
    }
    important = {key: value for key, value in important.items() if value}

    summary_source = (
        important.get("problemStatement")
        or important.get("functionalSolution")
        or important.get("technicalSolution")
        or important.get("businessOutcome")
        or ""
    )
    summary = _compact(summary_source, 300) if summary_source else "No project summary indexed yet."

    project = {
        "id": _project_id(company or title, title),
        "title": title,
        "projectName": project_name or title,
        "companyName": company or None,
        "summary": summary,
        "fields": normalized_fields,
        "sourceAssetId": asset["id"],
        "sourceAssetIds": [asset["id"]],
        "sourceAssetTitle": asset.get("title") or asset.get("fileName") or "Knowledge base",
        "sourceFileName": asset.get("fileName"),
        "sourceUploadedAt": asset.get("uploadedAt"),
        "sourceAssetType": asset.get("type"),
        "sourceCount": 1,
        "tags": asset.get("tags") or [],
        **important,
    }
    return project


def _project_quality(project: Dict[str, Any]) -> int:
    fields = project.get("fields") or {}
    quality = len(fields)
    for key in ("problemStatement", "functionalSolution", "technicalSolution", "businessOutcome"):
        if project.get(key):
            quality += 5
    return quality


def _merge_project(existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    if _project_quality(incoming) > _project_quality(existing):
        base, extra = incoming, existing
    else:
        base, extra = existing, incoming

    fields = {**(extra.get("fields") or {}), **(base.get("fields") or {})}
    source_ids = list(dict.fromkeys([*(existing.get("sourceAssetIds") or []), *(incoming.get("sourceAssetIds") or [])]))
    tags = list(dict.fromkeys([*(existing.get("tags") or []), *(incoming.get("tags") or [])]))
    return {
        **base,
        "fields": fields,
        "sourceAssetIds": source_ids,
        "sourceCount": len(source_ids),
        "tags": tags,
    }


def _rows_for_asset(ctx: TenantContext, asset: Dict[str, Any]) -> List[Dict[str, str]]:
    repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    row = repo.get_asset_row(tenant_uuid, asset["id"], clerk_key)
    if not row:
        return []

    chunks = repo.list_asset_chunks(ctx, asset["id"], limit=1000) if int(asset.get("chunkCount") or 0) > 0 else []
    if chunks:
        rows = _parse_chunk_rows(chunks)
        if rows:
            return rows

    if _is_csv_asset(asset) and row.get("storage_path"):
        try:
            return _parse_csv_rows(repo.download_file(ctx, str(row["storage_path"])))
        except Exception:
            pass

    return _parse_chunk_rows(chunks)


def list_kb_projects(ctx: TenantContext) -> List[Dict[str, Any]]:
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    cache_key = f"{tenant_uuid}:{clerk_key}"
    assets = get_kb_repository().list_assets(ctx)
    asset_signature = tuple(
        f"{asset.get('id')}:{asset.get('status')}:{asset.get('chunkCount')}:{asset.get('uploadedAt')}"
        for asset in assets
    )
    cached = _PROJECT_CACHE.get(cache_key)
    if cached and time.monotonic() - cached[0] < PROJECT_CACHE_TTL_SECONDS and cached[1] == asset_signature:
        return [dict(project) for project in cached[2]]

    projects_by_id: Dict[str, Dict[str, Any]] = {}
    seen_asset_signatures: set[str] = set()

    for asset in assets:
        if not _asset_is_projectish(asset):
            continue
        signature = "::".join(
            [
                str(asset.get("title") or ""),
                str(asset.get("fileName") or ""),
                str(asset.get("chunkCount") or 0),
                str(asset.get("status") or ""),
            ]
        ).lower()
        if signature in seen_asset_signatures and int(asset.get("chunkCount") or 0) > 0:
            continue
        seen_asset_signatures.add(signature)

        rows = _rows_for_asset(ctx, asset)
        for fields in rows:
            project = _row_to_project(fields, asset=asset)
            if not project:
                continue
            existing = projects_by_id.get(project["id"])
            projects_by_id[project["id"]] = _merge_project(existing, project) if existing else project

    projects = list(projects_by_id.values())
    projects.sort(
        key=lambda item: (
            str(item.get("sourceUploadedAt") or ""),
            str(item.get("title") or "").lower(),
        ),
        reverse=True,
    )
    _PROJECT_CACHE[cache_key] = (time.monotonic(), asset_signature, [dict(project) for project in projects])
    return projects


def get_kb_project(ctx: TenantContext, project_id: str) -> Optional[Dict[str, Any]]:
    return next((project for project in list_kb_projects(ctx) if project.get("id") == project_id), None)
