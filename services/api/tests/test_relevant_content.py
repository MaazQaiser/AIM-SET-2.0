from __future__ import annotations

from dc_core.tenancy import TenantContext

from app.agents.relevant_content import build_relevant_content


def test_build_relevant_content_splits_documents_and_projects(monkeypatch):
    ctx = TenantContext(tenant_id="tenant-a", user_id="u1", clerk_org_id="tenant-a")

    def fake_search(_ctx, _query, limit=15):
        return [
            {
                "asset_id": "kb-deck-1",
                "chunk_text": "Acme fintech deck overview",
                "metadata": {},
                "score": 0.92,
            },
            {
                "asset_id": "dc:pre-dc:rec-1",
                "chunk_text": "[pre-dc discovery notes]\nCompany: Acme\nNeed: compliance",
                "metadata": {"kind": "pre-dc"},
                "score": 0.81,
            },
        ]

    class FakeRepo:
        def get_asset_row(self, _tenant_uuid, asset_id, _clerk_key):
            if asset_id == "kb-deck-1":
                return {
                    "id": asset_id,
                    "title": "Fintech Deck",
                    "file_name": "fintech.pdf",
                    "mime_type": "application/pdf",
                    "storage_path": "tenant-a/kb-deck-1/fintech.pdf",
                }
            return None

    monkeypatch.setattr("app.agents.relevant_content._kb_search", fake_search)
    monkeypatch.setattr(
        "app.agents.relevant_content.get_kb_repository",
        lambda: FakeRepo(),
    )
    monkeypatch.setattr(
        "app.agents.relevant_content.resolve_kb_tenant",
        lambda _ctx: ("tenant-a", "tenant-a"),
    )

    out = build_relevant_content(
        ctx,
        "Acme Corp",
        {"needs": "compliance", "industry": "fintech"},
    )

    assert any(d["format"] == "pdf" for d in out["relevantDocuments"])
    assert any(p["source"] == "dc_notes" for p in out["relevantProjects"])
