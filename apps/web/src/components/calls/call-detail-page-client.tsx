"use client";

import { CallDetailView } from "@/components/calls/call-detail-view";

export function CallDetailPageClient({ callId }: { callId: string }) {
  return <CallDetailView callId={callId} />;
}
