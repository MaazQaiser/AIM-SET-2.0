import type { Metadata } from "next";
import { Suspense } from "react";
import { CallDetailPageClient } from "@/components/calls/call-detail-page-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Call brief" };

interface Params {
  params: Promise<{ callId: string }>;
}

export default async function CallDetailPage({ params }: Params) {
  const { callId } = await params;
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <CallDetailPageClient callId={callId} />
    </Suspense>
  );
}
