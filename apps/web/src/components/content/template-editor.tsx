"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  ChevronLeft,
  Code2,
  Eye,
  Loader2,
  MessageSquareText,
  Save,
  Send,
  Sparkles,
} from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Input } from "@dc-copilot/ui/components/input";
import { Label } from "@dc-copilot/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import {
  useContentTemplate,
  useCreateTemplate,
  useTemplateAssist,
  useUpdateTemplate,
} from "@/lib/data/content-studio-hooks";
import {
  compileTemplateDocument,
  parseTemplateTags,
  splitTemplateDocument,
  STARTER_TEMPLATE_CSS,
  STARTER_TEMPLATE_HTML,
  TEMPLATE_ARTIFACT_TYPES,
  type TemplateArtifactType,
} from "@/lib/content-studio/template-editor";
import type { ContentTemplateDraft } from "@/types/content_studio";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

const TEMPLATE_AGENT_PROMPTS = [
  "Generate a polished executive deck template with a clean blue accent",
  "Create a dark one-pager template with strong section hierarchy",
  "Redesign this template with a white background, tighter spacing, and premium typography",
] as const;

interface TemplateEditorProps {
  templateId?: string;
}

export function TemplateEditor({ templateId }: TemplateEditorProps) {
  const isEdit = Boolean(templateId);
  const detail = useContentTemplate(templateId);
  const create = useCreateTemplate();
  const update = useUpdateTemplate(templateId);
  const assist = useTemplateAssist();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState("New template");
  const [artifactType, setArtifactType] = useState<TemplateArtifactType>("deck");
  const [tagsText, setTagsText] = useState("");
  const [html, setHtml] = useState(STARTER_TEMPLATE_HTML);
  const [css, setCss] = useState(STARTER_TEMPLATE_CSS);
  const [instruction, setInstruction] = useState("");
  const [saveError, setSaveError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Tell me to generate a full template or change the current style. I will update the HTML and CSS draft here.",
    },
  ]);

  useEffect(() => {
    if (!detail.data || !isEdit) return;
    const parts = splitTemplateDocument(detail.data.html ?? "");
    setName(detail.data.name);
    setArtifactType(detail.data.artifactType);
    setTagsText(detail.data.tags.join(", "));
    setHtml(parts.html);
    setCss(parts.css);
  }, [detail.data, isEdit]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  });

  const previewHtml = useMemo(() => compileTemplateDocument(html, css), [html, css]);
  const draft = useMemo<ContentTemplateDraft>(
    () => ({
      name,
      artifactType,
      tags: parseTemplateTags(tagsText),
      html,
      css,
    }),
    [artifactType, css, html, name, tagsText]
  );
  const isSaving = create.isPending || update.isPending;

  async function handleSave() {
    setSaveError("");
    if (!name.trim()) {
      setSaveError("Template name is required.");
      return;
    }
    try {
      const saved = isEdit ? await update.mutateAsync(draft) : await create.mutateAsync(draft);
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (!isEdit) {
        window.location.href = `/content/templates/${saved.id}/edit`;
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save template");
    }
  }

  async function handleAssist() {
    const nextInstruction = instruction.trim();
    if (!nextInstruction) return;
    setInstruction("");
    setMessages((current) => [...current, { role: "user", content: nextInstruction }]);
    try {
      const result = await assist.mutateAsync({ ...draft, instruction: nextInstruction });
      setHtml(result.html);
      setCss(result.css);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.message || "Updated the template draft. Review the preview, then save.",
        },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "I could not update the template.",
        },
      ]);
    }
  }

  if (isEdit && detail.isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading template editor...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-6">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/content?tab=templates"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Templates
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">
              {isEdit ? "Edit template" : "Create template"}
            </h1>
            <Badge variant="secondary">HTML/CSS</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastSavedAt ? (
            <span className="text-xs text-muted-foreground">Saved {lastSavedAt}</span>
          ) : null}
          <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Save template
          </Button>
        </div>
      </div>

      {saveError ? <p className="shrink-0 text-sm text-destructive">{saveError}</p> : null}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-12">
        <Card className="min-h-0 xl:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Code2 className="h-4 w-4" />
              Template source
            </CardTitle>
          </CardHeader>
          <CardContent className="flex h-[calc(100%-4rem)] min-h-0 flex-col gap-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-type">Artifact type</Label>
                <select
                  id="template-type"
                  value={artifactType}
                  onChange={(event) => setArtifactType(event.target.value as TemplateArtifactType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {TEMPLATE_ARTIFACT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-tags">Tags</Label>
              <Input
                id="template-tags"
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                placeholder="enterprise, pitch, dark"
              />
            </div>

            <Tabs defaultValue="html" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="shrink-0">
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="css">CSS</TabsTrigger>
              </TabsList>
              <TabsContent value="html" className="min-h-0 flex-1">
                <Textarea
                  value={html}
                  onChange={(event) => setHtml(event.target.value)}
                  spellCheck={false}
                  className="h-full min-h-[320px] resize-none font-mono text-xs"
                />
              </TabsContent>
              <TabsContent value="css" className="min-h-0 flex-1">
                <Textarea
                  value={css}
                  onChange={(event) => setCss(event.target.value)}
                  spellCheck={false}
                  className="h-full min-h-[320px] resize-none font-mono text-xs"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="min-h-0 xl:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4" />
              Live preview
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)] min-h-0">
            <div className="h-full overflow-hidden rounded-md border bg-white">
              <iframe
                title="Template preview"
                srcDoc={previewHtml}
                className="h-full w-full"
                sandbox="allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-0 xl:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4" />
              Template agent
            </CardTitle>
          </CardHeader>
          <CardContent className="flex h-[calc(100%-4rem)] min-h-0 flex-col gap-3">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={
                    message.role === "user"
                      ? "ml-5 rounded-md bg-primary p-2 text-primary-foreground"
                      : "mr-5 rounded-md border bg-background p-2"
                  }
                >
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-medium opacity-80">
                    {message.role === "user" ? (
                      <MessageSquareText className="h-3 w-3" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {message.role === "user" ? "You" : "Agent"}
                  </div>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed">{message.content}</p>
                </div>
              ))}
              {assist.isPending ? (
                <div className="mr-5 flex items-center gap-2 rounded-md border bg-background p-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Updating draft...
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <form
              className="shrink-0 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAssist();
              }}
            >
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_AGENT_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto whitespace-normal px-2 py-1 text-left text-[11px]"
                    onClick={() => setInstruction(prompt)}
                    disabled={assist.isPending}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
              <Textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="Generate a polished dark executive deck template"
                className="min-h-[92px] resize-none"
                disabled={assist.isPending}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={assist.isPending || !instruction.trim()}
              >
                {assist.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                Generate / update draft
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
