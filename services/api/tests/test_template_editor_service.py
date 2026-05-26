from __future__ import annotations

import pytest

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.services.template_editor_service import (
    assist_template_edit,
    build_template_document,
    count_template_pages,
    extract_css_variables,
    split_template_parts,
    validate_template_html,
)


def test_build_template_document_splits_html_and_css() -> None:
    raw = """
    <!doctype html>
    <html>
      <head><style>:root { --accent: #2563eb; } h1 { color: var(--accent); }</style></head>
      <body><section class="slide" data-slide="1"><h1>Hello</h1></section></body>
    </html>
    """

    html, css = split_template_parts(raw)
    document = build_template_document(html, css)

    assert html == '<section class="slide" data-slide="1"><h1>Hello</h1></section>'
    assert "--accent: #2563eb" in css
    assert document.startswith("<!DOCTYPE html>")
    assert "<style>:root" in document
    assert count_template_pages(document, "deck") == 1
    assert extract_css_variables(css) == {"--accent": "#2563eb"}


def test_validate_template_html_blocks_unsafe_markup_and_css() -> None:
    with pytest.raises(ValueError, match="script_blocked"):
        validate_template_html("<section><script>alert(1)</script></section>", "")

    with pytest.raises(ValueError, match="@import"):
        validate_template_html("<section><h1>Hello</h1></section>", "@import url('https://example.com/x.css');")

    validate_template_html(
        '<section class="slide" data-slide="1"><h1>Hello</h1><p>Safe</p></section>',
        "body { background: #fff; }",
    )


def test_assist_template_edit_fallback_updates_css_without_api_key(monkeypatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    get_settings.cache_clear()
    ctx = TenantContext(tenant_id="tenant-template-editor", user_id="user-template-editor")

    result = assist_template_edit(
        ctx,
        name="Executive Template",
        artifact_type="deck",
        html='<section class="slide template-root" data-slide="1"><h1>Hello</h1></section>',
        css="body { background: #fff; }",
        instruction="Make the background navy and add a shadow",
    )

    assert result["html"].startswith('<section class="slide template-root"')
    assert "#1e3a8a" in result["css"]
    assert "box-shadow" in result["css"]
    assert result["model"] == "fallback-local"


def test_assist_template_edit_fallback_can_generate_polished_template(monkeypatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    get_settings.cache_clear()
    ctx = TenantContext(tenant_id="tenant-template-editor", user_id="user-template-editor")

    result = assist_template_edit(
        ctx,
        name="Generated Template",
        artifact_type="deck",
        html="",
        css="",
        instruction="Generate a polished dark executive deck template with a purple accent",
    )

    assert 'class="slide template-root cover-slide"' in result["html"]
    assert "--accent: #7c3aed" in result["css"]
    assert "--bg: #0f172a" in result["css"]
    validate_template_html(result["html"], result["css"])
