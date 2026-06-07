"use client";

import { useState } from "react";
import { CheckCircle2, Trophy, XCircle } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { Label } from "@dc-copilot/ui/components/label";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@dc-copilot/ui/components/tooltip";
import { useDealClosure, type DealOutcome } from "@/stores/use-call-workflow";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

interface PostDcCloseDealActionProps {
  callId: string;
  className?: string;
  compact?: boolean;
}

export function PostDcCloseDealAction({
  callId,
  className,
  compact = true,
}: PostDcCloseDealActionProps) {
  const { closure, isClosed, closeDeal, reopenDeal } = useDealClosure(callId);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<DealOutcome>("won");
  const [lostReason, setLostReason] = useState("");

  function resetDialog() {
    setOutcome("won");
    setLostReason("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetDialog();
  }

  function handleConfirm() {
    if (outcome === "lost" && !lostReason.trim()) {
      toast.error("Add a reason when marking the deal as lost");
      return;
    }
    closeDeal(outcome, lostReason);
    setOpen(false);
    resetDialog();
    toast.success(outcome === "won" ? "Call marked closed won" : "Call marked closed lost");
  }

  return (
    <>
      <div className={cn("inline-flex items-center gap-2", className)}>
        {isClosed && closure ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  "h-6 gap-1 type-label",
                  closure.outcome === "won"
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
                )}
              >
                {closure.outcome === "won" ? (
                  <Trophy className="h-3 w-3" aria-hidden />
                ) : (
                  <XCircle className="h-3 w-3" aria-hidden />
                )}
                Closed {closure.outcome}
              </Badge>
            </TooltipTrigger>
            {closure.outcome === "lost" && closure.lostReason ? (
              <TooltipContent side="bottom" className="max-w-xs type-label">
                {closure.lostReason}
              </TooltipContent>
            ) : null}
          </Tooltip>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant={isClosed ? "outline" : "default"}
          className={cn(compact && "h-8 rounded-full px-4 type-body font-bold")}
          onClick={() => {
            if (isClosed) {
              reopenDeal();
              toast.message("Deal reopened for wrap-up");
              return;
            }
            setOpen(true);
          }}
        >
          {isClosed ? (
            <>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Reopen deal
            </>
          ) : (
            <>
              <Trophy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Mark call closed
            </>
          )}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close this call</DialogTitle>
            <DialogDescription>
              Record the final outcome so leadership and analytics can track win/loss.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={outcome === "won" ? "default" : "outline"}
                className={cn(
                  "h-auto flex-col gap-1 py-3",
                  outcome === "won" && "border-success bg-success text-success-foreground hover:bg-success/90"
                )}
                onClick={() => setOutcome("won")}
              >
                <Trophy className="h-4 w-4" aria-hidden />
                Closed won
              </Button>
              <Button
                type="button"
                variant={outcome === "lost" ? "default" : "outline"}
                className={cn(
                  "h-auto flex-col gap-1 py-3",
                  outcome === "lost" && "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90"
                )}
                onClick={() => setOutcome("lost")}
              >
                <XCircle className="h-4 w-4" aria-hidden />
                Closed lost
              </Button>
            </div>

            {outcome === "lost" ? (
              <div className="space-y-2">
                <Label htmlFor="lost-reason">Why was this deal lost?</Label>
                <Textarea
                  id="lost-reason"
                  value={lostReason}
                  onChange={(event) => setLostReason(event.target.value)}
                  placeholder="e.g. Budget frozen, chose incumbent vendor, timing slipped to next quarter…"
                  rows={4}
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirm}>
              Confirm close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
