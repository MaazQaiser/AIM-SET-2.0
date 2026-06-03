"use client";

import { use } from "react";
import { ClpEditorScreen } from "@/components/landing-page/clp-editor-screen";

interface PageParams {
  params: Promise<{ callId: string }>;
}

export default function LandingPageEditorPage({ params }: PageParams) {
  const { callId } = use(params);
  return <ClpEditorScreen callId={callId} />;
}
