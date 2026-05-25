import { describe, expect, it } from "vitest";
import {
  compileTemplateDocument,
  parseTemplateTags,
  splitTemplateDocument,
  STARTER_TEMPLATE_CSS,
  STARTER_TEMPLATE_HTML,
} from "./template-editor";

describe("template editor helpers", () => {
  it("splits a stored full document into editable html and css", () => {
    const fullDocument = [
      "<!DOCTYPE html>",
      "<html>",
      "<head><style>:root { --accent: #2563eb; } h1 { color: var(--accent); }</style></head>",
      '<body><section class="slide" data-slide="1"><h1>Hello</h1></section></body>',
      "</html>",
    ].join("");

    const parts = splitTemplateDocument(fullDocument);

    expect(parts.html).toBe('<section class="slide" data-slide="1"><h1>Hello</h1></section>');
    expect(parts.css).toContain("--accent: #2563eb");
    expect(parts.css).not.toContain("<style>");
  });

  it("compiles html and css into a preview document", () => {
    const doc = compileTemplateDocument("<main><h1>Preview</h1></main>", "body { margin: 0; }");

    expect(doc).toContain("<!DOCTYPE html>");
    expect(doc).toContain("<style>");
    expect(doc).toContain("body { margin: 0; }");
    expect(doc).toContain("<main><h1>Preview</h1></main>");
  });

  it("returns starter content for empty templates", () => {
    const parts = splitTemplateDocument("");

    expect(parts.html).toBe(STARTER_TEMPLATE_HTML);
    expect(parts.css).toBe(STARTER_TEMPLATE_CSS);
  });

  it("parses comma separated template tags", () => {
    expect(parseTemplateTags(" enterprise, pitch deck, , dark ")).toEqual([
      "enterprise",
      "pitch deck",
      "dark",
    ]);
  });
});
