"use client";

export function StudioPreview({ html }: { html?: string }) {
  if (!html) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Preview will appear after the agent generates HTML.
      </div>
    );
  }

  return (
    <div className="h-full min-h-[400px] rounded-lg border border-border overflow-hidden bg-white">
      <iframe
        title="Content preview"
        srcDoc={html}
        sandbox="allow-same-origin"
        className="w-full h-full min-h-[480px] border-0"
      />
    </div>
  );
}
