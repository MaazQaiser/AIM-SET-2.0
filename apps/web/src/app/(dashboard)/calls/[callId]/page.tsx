import type { Metadata } from "next";
import { Suspense } from "react";
import { CallDetailPageClient } from "@/components/calls/call-detail-page-client";
import { CallDetailPageLoader } from "@/components/layout/page-loaders";

export const metadata: Metadata = { title: "Call brief" };

interface Params {
  params: Promise<{ callId: string }>;
}

export default async function CallDetailPage({ params }: Params) {
  const { callId } = await params;
  return (
    <Suspense fallback={<CallDetailPageLoader />}>
      <CallDetailPageClient callId={callId} />
    </Suspense>
  );
}
