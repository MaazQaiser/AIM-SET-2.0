"use client";

import { use } from "react";
import { TemplateScratchBuilder } from "@/components/content/template-scratch-builder";

export default function EditScratchTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(params);
  return <TemplateScratchBuilder templateId={templateId} />;
}
