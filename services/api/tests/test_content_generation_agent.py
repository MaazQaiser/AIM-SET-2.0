from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

from dc_core.tenancy import TenantContext

from app.agents.content_generation_agent import run_studio_turn
from app.config import get_settings


class _FakeContentStudioRepo:
    def __init__(self) -> None:
        self.project: Dict[str, Any] = {
            "id": "project-1",
            "title": "Surgical Center Growth Deck",
            "artifactType": "deck",
            "templateId": "template-1",
            "brief": {},
            "costUsd": 0,
        }
        self.template: Dict[str, Any] = {
            "id": "template-1",
            "name": "Premium Blue Deck",
            "artifactType": "deck",
            "cssVariables": {
                "--accent": "#ff00aa",
                "--surface": "#101827",
                "--text": "#f8fafc",
                "--muted": "#cbd5e1",
            },
            "html": (
                "<!DOCTYPE html><html><head><style>"
                ":root { --accent: #ff00aa; --surface: #101827; --text: #f8fafc; --muted: #cbd5e1; }"
                ".slide { border: 4px solid var(--accent); }"
                "</style></head><body></body></html>"
            ),
        }
        self.revisions: List[Dict[str, Any]] = []

    def get_project(self, _ctx: TenantContext, project_id: str) -> Dict[str, Any] | None:
        if project_id != self.project["id"]:
            return None
        return dict(self.project)

    def update_project(self, _ctx: TenantContext, project_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        assert project_id == self.project["id"]
        self.project.update(patch)
        return dict(self.project)

    def list_templates(self, _ctx: TenantContext, artifact_type: Optional[str] = None) -> List[Dict[str, Any]]:
        return []

    def list_messages(self, _ctx: TenantContext, project_id: str) -> List[Dict[str, Any]]:
        assert project_id == self.project["id"]
        return []

    def get_template(self, _ctx: TenantContext, template_id: str) -> Optional[Dict[str, Any]]:
        return dict(self.template) if template_id == self.template["id"] else None

    def list_kb_asset_ids(self, _ctx: TenantContext) -> Set[str]:
        return set()

    def latest_revision(self, _ctx: TenantContext, project_id: str) -> Optional[Dict[str, Any]]:
        assert project_id == self.project["id"]
        return self.revisions[-1] if self.revisions else None

    def create_revision(
        self,
        _ctx: TenantContext,
        project_id: str,
        *,
        html: str,
        citations: List[Dict[str, Any]],
        template_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        assert project_id == self.project["id"]
        revision = {
            "id": f"revision-{len(self.revisions) + 1}",
            "projectId": project_id,
            "html": html,
            "citations": citations,
            "templateId": template_id,
        }
        self.revisions.append(revision)
        return revision


def test_studio_turn_collects_basics_then_slide_count_and_outline(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    get_settings.cache_clear()
    repo = _FakeContentStudioRepo()
    ctx = TenantContext(tenant_id="tenant-content", user_id="user-content")

    first = run_studio_turn(
        ctx,
        project_id="project-1",
        user_message="",
        allow_generation=False,
        repo=repo,
    )
    assert first.result["turn_type"] == "ask"
    assert first.result["ask"] == [
        "Who is this deck for, and what role or team should it speak to?",
        "Which customer pain points or business problems need to be covered?",
        "Is this a case study, or can you describe the context this content should use?",
    ]

    basics = run_studio_turn(
        ctx,
        project_id="project-1",
        user_message=(
            "Audience: hospital operations leaders. "
            "Pain points: scheduling friction, patient intake delays, reporting visibility gaps. "
            "Context: case study for a surgical center network."
        ),
        allow_generation=False,
        repo=repo,
    )
    assert basics.result["ask"] == ["How many slides should this deck include?"]

    outline = run_studio_turn(
        ctx,
        project_id="project-1",
        user_message="5 slides",
        allow_generation=False,
        repo=repo,
    )
    assert outline.result["turn_type"] == "ask"
    assert outline.result["slide_outline"]
    assert len(outline.result["slide_outline"]) == 5
    assert outline.result["slide_outline"][1]["heading"] == "scheduling friction"
    assert "Visual:" not in outline.result["message"]

    edited = run_studio_turn(
        ctx,
        project_id="project-1",
        user_message=(
            "Slide 2 heading: Intake bottlenecks "
            "body: Show staff time lost to slow patient intake "
            "visual: workflow chart"
        ),
        allow_generation=False,
        repo=repo,
    )
    slide_2 = edited.result["slide_outline"][1]
    assert slide_2["heading"] == "Intake bottlenecks"
    assert slide_2["body"] == "Show staff time lost to slow patient intake"
    assert slide_2["visual"] == "workflow chart"

    generated = run_studio_turn(
        ctx,
        project_id="project-1",
        user_message="Generate deck",
        allow_generation=True,
        repo=repo,
    )
    assert generated.operation == "html_generate"
    assert generated.result["turn_type"] == "html"
    assert generated.result["revision_id"] == "revision-1"
    assert generated.result["html"].count('class="slide dc-slide template-root"') == 5
    assert "Intake bottlenecks" in generated.result["html"]
    assert "Show staff time lost to slow patient intake" in generated.result["html"]
    assert "#ff00aa" in generated.result["html"]
    assert generated.result["template_id"] == "template-1"
    assert len(repo.revisions) == 1
    assert "What are the 3 key points" not in str(generated.result)

    preview_edit = run_studio_turn(
        ctx,
        project_id="project-1",
        user_message=(
            "Slide 3 heading: Faster intake "
            "body: Show the redesigned patient intake flow "
            "visual: before and after process chart"
        ),
        allow_generation=False,
        repo=repo,
    )
    assert preview_edit.operation == "html_patch"
    assert preview_edit.result["turn_type"] == "patch"
    assert preview_edit.result["revision_id"] == "revision-2"
    assert "Faster intake" in preview_edit.result["html"]
    assert "before and after process chart" in preview_edit.result["html"]
    assert len(repo.revisions) == 2
