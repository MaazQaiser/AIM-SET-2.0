"use client";

import { useSearchParams } from "next/navigation";
import { CallDetailView } from "@/components/calls/call-detail-view";

export function CallDetailPageClient({ callId }: { callId: string }) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "post-dc" ? "post-dc" : "brief";

  return <CallDetailView callId={callId} initialTab={tab} />;
}
