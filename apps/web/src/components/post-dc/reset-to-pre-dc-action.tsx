"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@dc-copilot/ui/components/tooltip";
import { useDcImportsStore } from "@/stores/use-dc-imports";

interface ResetToPreDcActionProps {
  callId: string;
}

export function ResetToPreDcAction({ callId }: ResetToPreDcActionProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const resetCallToPreDc = useDcImportsStore((s) => s.resetCallToPreDc);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (loading) return;
    setLoading(true);
    resetCallToPreDc(callId);

    try {
      const res = await fetch(`/api/calls/${callId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "upcoming" }),
      });
      if (!res.ok) throw new Error("Status reset failed");
      toast.success("Moved back to Pre-DC");
    } catch {
      toast.message("Moved back locally", {
        description: "The demo reset is active in this browser session.",
      });
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["calls"] });
      await queryClient.invalidateQueries({ queryKey: ["call", callId] });
      await queryClient.invalidateQueries({ queryKey: ["post-call", callId] });
      setLoading(false);
      router.push(`/calls/${callId}`);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={loading}
          onClick={() => void handleReset()}
          aria-label="Reset to Pre-DC"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="type-label">
        Reset to Pre-DC
      </TooltipContent>
    </Tooltip>
  );
}
