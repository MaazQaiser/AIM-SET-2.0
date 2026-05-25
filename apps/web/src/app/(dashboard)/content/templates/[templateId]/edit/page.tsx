"use client";

import { use } from "react";
import { TemplateEditor } from "@/components/content/template-editor";

export default function EditTemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = use(params);
  return <TemplateEditor templateId={templateId} />;
}
