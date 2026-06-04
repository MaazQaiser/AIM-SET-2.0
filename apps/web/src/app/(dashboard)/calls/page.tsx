import type { Metadata } from "next";
import { CallsListClient } from "@/components/calls/calls-list-client";

export const metadata: Metadata = { title: "Calls" };

export default function CallsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CallsListClient />
    </div>
  );
}
