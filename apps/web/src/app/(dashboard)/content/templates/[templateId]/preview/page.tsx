"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { TemplatePreviewPage } from "@/components/content/template-preview-page";

export default function TemplatePreviewRoute({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(params);
  const searchParams = useSearchParams();
  const returnHref = searchParams.get("returnTo") ?? "/content?tab=templates";
  const pickMode = searchParams.get("pick") === "1";
  const selectedTemplateId = searchParams.get("selected") ?? undefined;

  return (
    <TemplatePreviewPage
      templateId={templateId}
      returnHref={returnHref}
      pickMode={pickMode}
      selectedTemplateId={selectedTemplateId ?? undefined}
    />
  );
}
