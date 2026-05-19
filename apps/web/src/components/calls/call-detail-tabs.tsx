"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BriefSections } from "@/components/pre-call/brief-sections";
import { PostDCReviewPanel } from "@/components/post-dc/post-dc-review-panel";
import { useCallBrief } from "@/lib/data/hooks";
import { usePersona } from "@/hooks/use-persona";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FileSpreadsheet } from "lucide-react";
import type { BANTScore } from "@/types";

interface CallDetailTabsProps {
  callId: string;
  discoveryQuestions: string[];
  bant: BANTScore;
}

export function CallDetailTabs({ callId, discoveryQuestions, bant }: CallDetailTabsProps) {
  const { data: brief, isLoading } = useCallBrief(callId);
  const persona = usePersona();

  return (
    <Tabs defaultValue="brief">
      <TabsList>
        <TabsTrigger value="brief">Pre-call brief</TabsTrigger>
        <TabsTrigger value="post-dc">Post-DC review</TabsTrigger>
      </TabsList>

      <TabsContent value="brief" className="mt-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !brief ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No Pre-DC brief for this call"
            description="Import pre_dc_notes_data.csv in Settings with this company included."
            action={{ label: "Import CSV", href: "/settings" }}
          />
        ) : (
          <BriefSections
            brief={brief}
            bant={bant}
            discoveryQuestions={discoveryQuestions}
            leadershipPreview={persona === "leadership"}
          />
        )}
      </TabsContent>

      <TabsContent value="post-dc" className="mt-4">
        <PostDCReviewPanel callId={callId} />
      </TabsContent>
    </Tabs>
  );
}
