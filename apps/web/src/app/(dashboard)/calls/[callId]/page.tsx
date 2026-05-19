import type { Metadata } from "next";
import { CallDetailView } from "@/components/calls/call-detail-view";

export const metadata: Metadata = { title: "Call brief" };

interface Params {
  params: Promise<{ callId: string }>;
}

export default async function CallDetailPage({ params }: Params) {
  const { callId } = await params;
  return <CallDetailView callId={callId} />;
}
