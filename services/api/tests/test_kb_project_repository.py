from __future__ import annotations

from dc_core.tenancy import TenantContext

from app.domain.kb_project_repository import (
    _enrich_project_metadata,
    _parse_csv_rows,
    _row_to_project,
    _rows_for_asset,
)

PROJECT_CSV = (
    "Company Name,Project Name,Problem Statement,Technical Solution,LinkedIn Industry,Domain\n"
    "Acme LLC,Acme Workflow,\"Manual approvals delayed teams\","
    "\"Jira automation and reporting\",Software & IT Services,Operations Management\n"
    "Beta Inc,Beta Portal,\"Legacy portal blocked sales\","
    "\"React rebuild with SSO\",Software & IT Services,Customer Portal\n"
).encode("utf-8")

PARTIAL_CHUNK_ROWS = [
    {
        "chunk_index": 0,
        "chunk_text": (
            "Company Name: Acme LLC; Project Name: Acme Workflow; "
            "Problem Statement: Manual approvals delayed teams"
        ),
    }
]


def test_parse_kb_project_csv_and_build_project():
    raw = (
        "Company Name,Project Name,Problem Statement,Technical Solution,LinkedIn Industry,Domain\n"
        "Acme LLC,Acme Workflow,\"Manual approvals delayed teams\","
        "\"Jira automation and reporting\",Software & IT Services,Operations Management\n"
    ).encode("cp1252")

    rows = _parse_csv_rows(raw)
    project = _row_to_project(
        rows[0],
        asset={
            "id": "kb-projects",
            "title": "Projects for Sale Enablement",
            "fileName": "Projects for Sale Enablement.csv",
            "uploadedAt": "2026-05-22",
            "type": "one-pager",
            "tags": ["project data"],
        },
    )

    assert project is not None
    assert project["title"] == "Acme Workflow"
    assert project["rawProjectName"] == "Acme Workflow"
    assert project["companyName"] == "Acme LLC"
    assert project["industry"] == "Software & IT Services"
    assert project["domain"] == "Operations Management"
    assert project["technicalSolution"] == "Jira automation and reporting"
    assert project["sourceAssetId"] == "kb-projects"


def test_enriches_project_industry_from_description():
    project = _row_to_project(
        {
            "Company Name": "SchoolTracks Ltd",
            "Project Name": "SchoolTracks - UI/UX",
            "Problem Statement": "Classroom management software for education centers with class scheduling and student management.",
        },
        asset={
            "id": "kb-projects",
            "title": "Projects for Sale Enablement",
            "fileName": "Projects for Sale Enablement.csv",
            "uploadedAt": "2026-05-22",
            "type": "one-pager",
            "tags": ["project data"],
        },
    )

    enriched = _enrich_project_metadata(project)

    assert enriched["industry"] == "Education"
    assert enriched["domain"] == "Classroom Management"


def test_enriches_sparse_known_project_row():
    project = _row_to_project(
        {
            "Company Name": "InCours, Inc.",
            "Project Name": "Incours",
            "Problem Statement": "Branding: C",
        },
        asset={
            "id": "kb-projects",
            "title": "Projects for Sale Enablement",
            "fileName": "Projects for Sale Enablement.csv",
            "uploadedAt": "2026-05-22",
            "type": "one-pager",
            "tags": ["project data"],
        },
    )

    enriched = _enrich_project_metadata(project)

    assert enriched["industry"] == "Education"
    assert enriched["domain"] == "Learning Marketplace"


def test_enriches_sparse_row_with_synthetic_summary():
    project = _row_to_project(
        {
            "Company Name": "Crowdbotics",
            "Project Name": "XP-ZYVLY-SOW#8 (47204-1)",
            "LinkedIn Industry": "Software & IT Services",
            "Company Stage test": "Startup",
        },
        asset={
            "id": "kb-projects",
            "title": "Projects for Sale Enablement",
            "fileName": "Projects for Sale Enablement.csv",
            "uploadedAt": "2026-05-22",
            "type": "one-pager",
            "tags": ["project data"],
        },
    )

    enriched = _enrich_project_metadata(project)

    assert enriched["title"] == "ZYVLY"
    assert enriched["rawProjectName"] == "XP-ZYVLY-SOW#8 (47204-1)"
    assert enriched["domain"] == "Custom Application Development"
    assert enriched["summary"] != "No project summary indexed yet."
    assert "Crowdbotics" in enriched["summary"]
    assert "ZYVLY" in enriched["summary"]


def test_cleans_project_name_contract_noise_for_listing():
    cases = {
        "Volantio - Dedicated Team - SOW#1": "Volantio",
        "VisionInvest- SOW#1 PO#00095": "VisionInvest",
        "XP-Care- AI Like Me -SOW-43395-1": "Care AI Like Me",
        "SchoolTracks - UI/UX": "SchoolTracks",
        "PBD West (Design)": "PBD West",
        "REI - Document Generation Platform - Additional Project": "REI - Document Generation Platform",
    }

    for raw_name, expected in cases.items():
        project = _row_to_project(
            {
                "Company Name": "Example Co",
                "Project Name": raw_name,
                "Problem Statement": "Example implementation scope.",
            },
            asset={
                "id": "kb-projects",
                "title": "Projects for Sale Enablement",
                "fileName": "Projects for Sale Enablement.csv",
                "uploadedAt": "2026-05-22",
                "type": "one-pager",
                "tags": ["project data"],
            },
        )

        assert project is not None
        assert project["title"] == expected
        assert project["projectName"] == expected
        assert project["rawProjectName"] == raw_name


def test_ignores_case_study_link_without_project_identity():
    project = _row_to_project(
        {
            "Case Study": "https://drive.google.com/drive/folders/example",
            "LinkedIn Industry": "Software & IT Services",
        },
        asset={
            "id": "kb-projects",
            "title": "Projects for Sale Enablement",
            "fileName": "Projects for Sale Enablement.csv",
            "uploadedAt": "2026-05-22",
            "type": "one-pager",
            "tags": ["project data"],
        },
    )

    assert project is None


def test_excludes_case_study_link_from_project_fields():
    project = _row_to_project(
        {
            "Company Name": "Acme LLC",
            "Project Name": "Acme Workflow",
            "Problem Statement": "Manual approvals delayed teams",
            "Case Study": "https://drive.google.com/drive/folders/example",
        },
        asset={
            "id": "kb-projects",
            "title": "Projects for Sale Enablement",
            "fileName": "Projects for Sale Enablement.csv",
            "uploadedAt": "2026-05-22",
            "type": "one-pager",
            "tags": ["project data"],
        },
    )

    assert project is not None
    assert "Case Study" not in project["fields"]


def test_enriches_and_normalizes_existing_project_industry():
    project = _row_to_project(
        {
            "Company Name": "Replenium",
            "Project Name": "Replenium",
            "Problem Statement": "Recurring orders for ecommerce web applications.",
            "LinkedIn Industry": "Software & I",
        },
        asset={
            "id": "kb-projects",
            "title": "Projects for Sale Enablement",
            "fileName": "Projects for Sale Enablement.csv",
            "uploadedAt": "2026-05-22",
            "type": "one-pager",
            "tags": ["project data"],
        },
    )

    enriched = _enrich_project_metadata(project)

    assert enriched["industry"] == "E-Commerce"
    assert enriched["domain"] == "Recurring Orders"


def test_rows_for_asset_prefers_full_csv_over_ingest_chunks(monkeypatch):
    ctx = TenantContext(tenant_id="tenant-test", user_id="user-test", clerk_org_id="tenant-test")
    asset = {
        "id": "kb-project-csv",
        "title": "Company Projects",
        "fileName": "Company Projects.csv",
        "chunkCount": 282,
        "status": "ready",
    }

    class FakeRepo:
        def get_asset_row(self, tenant_uuid, asset_id, clerk_key):
            return {"storage_path": "kb/company-projects.csv"}

        def download_file(self, ctx, storage_path):
            return PROJECT_CSV

        def list_asset_chunks(self, ctx, asset_id, limit=1000):
            return PARTIAL_CHUNK_ROWS

    monkeypatch.setattr(
        "app.domain.kb_project_repository.get_kb_repository",
        lambda: FakeRepo(),
    )

    rows = _rows_for_asset(ctx, asset)

    assert len(rows) == 2
    assert rows[0]["Company Name"] == "Acme LLC"
    assert rows[1]["Project Name"] == "Beta Portal"


def test_enriches_industry_from_existing_domain():
    project = _row_to_project(
        {
            "Project Name": "https://drive.google.com/file/d/example/view",
            "Domain": "Data Management",
            "Sub domain": "Data Analytics",
        },
        asset={
            "id": "kb-projects",
            "title": "Projects for Sale Enablement",
            "fileName": "Projects for Sale Enablement.csv",
            "uploadedAt": "2026-05-22",
            "type": "one-pager",
            "tags": ["project data"],
        },
    )

    enriched = _enrich_project_metadata(project)

    assert enriched["industry"] == "Data & Analytics"
    assert enriched["domain"] == "Data Management"
