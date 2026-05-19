from __future__ import annotations

import csv
import tempfile
from pathlib import Path

from dc_core.tenancy import TenantContext
from dc_embeddings.client import EmbeddingClient
from dc_kb.chunking import split_text
from dc_kb.extract import extract_document

from app.config import get_settings
from app.domain.kb_repository import get_kb_repository
from app.domain.memory_store import get_memory_store
from app.services.kb_ingest_service import process_ingest_job


def test_split_text_overlap():
    text = "word " * 500
    chunks = split_text(text, chunk_size=200, overlap=50)
    assert len(chunks) > 1
    assert all(c.text for c in chunks)


def test_fake_embeddings_dim():
    client = EmbeddingClient(api_key="")
    result = client.embed(["hello", "world"])
    assert len(result.embeddings) == 2
    assert len(result.embeddings[0]) == 1536


def test_csv_extract_and_ingest_memory(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    get_settings.cache_clear()
    settings = get_settings()
    monkeypatch.setattr(settings, "openai_api_key", "")
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "value"])
        writer.writeheader()
        writer.writerow({"name": "Acme", "value": "42"})
        path = f.name

    doc = extract_document(path, mime_type="text/csv")
    Path(path).unlink(missing_ok=True)
    assert doc.chunks

    ctx = TenantContext(tenant_id="org-test", user_id="user-1", clerk_org_id="org-test")
    repo = get_kb_repository()
    content = b"name,value\nAcme,42\n"
    result = repo.create_upload(
        ctx,
        file_name="test.csv",
        file_bytes=content,
        ext=".csv",
        title="Test CSV",
        tags=["healthcare", "q4"],
        asset_type="architecture",
    )
    job = {
        "id": result["job"]["id"],
        "tenant_id": repo._tenants.resolve(ctx)[0],
        "asset_id": result["asset"]["id"],
        "_clerk_key": "org-test",
    }
    process_ingest_job(job, repo)
    asset = repo.get_asset(ctx, result["asset"]["id"])
    assert asset is not None
    assert asset.get("status") == "ready"
    assert asset.get("type") == "architecture"
    assert asset.get("tags") == ["healthcare", "q4"]
    assert (asset.get("chunkCount") or 0) > 0

    chunks = get_memory_store().kb_chunks.get("org-test", [])
    asset_chunks = [c for c in chunks if c.get("asset_id") == result["asset"]["id"]]
    assert asset_chunks
    meta = asset_chunks[0].get("metadata") or {}
    assert meta.get("asset_id") == result["asset"]["id"]
    assert meta.get("asset_type") == "architecture"
    assert meta.get("tags") == ["healthcare", "q4"]
    assert meta.get("title") == "Test CSV"
