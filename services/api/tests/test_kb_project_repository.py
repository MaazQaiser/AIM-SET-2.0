from __future__ import annotations

from app.domain.kb_project_repository import _parse_csv_rows, _row_to_project


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
            "type": "case-study",
            "tags": ["project data"],
        },
    )

    assert project is not None
    assert project["title"] == "Acme Workflow"
    assert project["companyName"] == "Acme LLC"
    assert project["industry"] == "Software & IT Services"
    assert project["domain"] == "Operations Management"
    assert project["technicalSolution"] == "Jira automation and reporting"
    assert project["sourceAssetId"] == "kb-projects"
