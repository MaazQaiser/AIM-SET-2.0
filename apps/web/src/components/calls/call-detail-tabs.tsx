"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardGrid } from "@/components/dashboard-grid/dashboard-grid";
import { LayoutControls } from "@/components/dashboard-grid/layout-controls";
import { PostDCReviewPanel } from "@/components/post-dc/post-dc-review-panel";
import { BRIEF_WIDGETS, POST_DC_WIDGETS } from "@/lib/dashboard/widget-registry";
import { useCallBrief, usePostCallReview } from "@/lib/data/hooks";
import { usePersona } from "@/hooks/use-persona";
import { useDashboardLayoutStore } from "@/stores/use-dashboard-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { AccountSnapshotRow } from "@/components/calls/account-widget-cards";
import type { BANTScore, Call } from "@/types";

interface CallDetailTabsProps {
  callId: string;
  discoveryQuestions: string[];
  bant: BANTScore;
  call: Call;
  accountSnapshot: AccountSnapshotRow[];
}

export function CallDetailTabs({
  callId,
  discoveryQuestions,
  bant,
  call,
  accountSnapshot,
}: CallDetailTabsProps) {
  const { data: brief, isLoading: briefLoading } = useCallBrief(callId);
  const { data: review, isLoading: reviewLoading } = usePostCallReview(callId);
  const persona = usePersona();
  const setEditing = useDashboardLayoutStore((s) => s.setEditing);
  const [activeTab, setActiveTab] = useState("brief");

  const leadershipPreview = persona === "leadership";

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setEditing(false);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="brief">Pre-call brief</TabsTrigger>
        <TabsTrigger value="post-dc">Post-DC review</TabsTrigger>
      </TabsList>

      <TabsContent value="brief" className="mt-4">
        {briefLoading ? (
          <BriefTabSkeleton />
        ) : !brief ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No Pre-DC brief for this call"
            description="Import pre_dc_notes_data.csv in Settings with this company included."
            action={{ label: "Import CSV", href: "/settings" }}
          />
        ) : (
          <>
            <LayoutControls
              layoutKey="brief"
              widgets={BRIEF_WIDGETS}
              widgetProps={{ brief, bant, discoveryQuestions, leadershipPreview, call, accountSnapshot }}
            />
            <DashboardGrid
              layoutKey="brief"
              widgets={BRIEF_WIDGETS}
              widgetProps={{ brief, bant, discoveryQuestions, leadershipPreview, call, accountSnapshot }}
            />
          </>
        )}
      </TabsContent>

      <TabsContent value="post-dc" className="mt-4">
        {reviewLoading ? (
          <PostDcTabSkeleton />
        ) : !review ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No Post-DC notes for this call"
            description="Import post_dc_notes_data.csv in Settings. Rows link when company or lead names match Pre-DC data."
            action={{ label: "Import CSV", href: "/settings" }}
          />
        ) : (
          <>
            <LayoutControls
              layoutKey="post-dc"
              widgets={POST_DC_WIDGETS}
              widgetProps={{ review, call, accountSnapshot }}
            />
            <DashboardGrid
              layoutKey="post-dc"
              widgets={POST_DC_WIDGETS}
              widgetProps={{ review, call, accountSnapshot }}
            />
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}

function BriefTabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function PostDcTabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
