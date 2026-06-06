"use client";

import { useState, type ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import {
  BriefDetailCard,
  briefDetailDialogClass,
  briefBodyClass,
  briefBodyMutedClass,
  type BriefDetailCardProps,
} from "@/components/pre-call/brief-detail-card";
import { POST_DC_EXPAND_MODAL_CLASS } from "@/components/post-dc/post-dc-modal-section";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

interface PostDcExpandableCardProps extends Omit<BriefDetailCardProps, "headerExtra"> {
  headerExtra?: ReactNode;
  /** Subtitle under title in expand modal header */
  modalDescription?: ReactNode;
  /** Extra controls in expand modal header row */
  modalHeaderExtra?: ReactNode;
  /** Optional richer content in the expand modal (defaults to children) */
  modalContent?: ReactNode;
  modalClassName?: string;
  expandLabel?: string;
}

/** Post-DC card with expand → centered modal. */
export function PostDcExpandableCard({
  title,
  children,
  modalContent,
  modalDescription,
  modalHeaderExtra,
  modalClassName,
  headerExtra,
  expandLabel = "Expand card",
  className,
  ...cardProps
}: PostDcExpandableCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <BriefDetailCard
        {...cardProps}
        title={title}
        className={cn("h-full flex flex-col", className)}
        headerExtra={
          <div className="flex items-center gap-1 shrink-0">
            {headerExtra}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  aria-label={expandLabel}
                  onClick={() => setOpen(true)}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">{expandLabel}</TooltipContent>
            </Tooltip>
          </div>
        }
      >
        {children}
      </BriefDetailCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            briefDetailDialogClass,
            POST_DC_EXPAND_MODAL_CLASS,
            "flex flex-col overflow-hidden p-0 gap-0",
            modalClassName
          )}
        >
          <DialogHeader className="shrink-0 px-6 pt-5 pb-4 border-b border-border/60 space-y-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <DialogTitle className="text-lg">{title}</DialogTitle>
                {modalDescription ? (
                  <p className={cn(briefBodyMutedClass, "post-dc-copy")}>{modalDescription}</p>
                ) : null}
              </div>
              {modalHeaderExtra ? (
                <div className="shrink-0">{modalHeaderExtra}</div>
              ) : null}
            </div>
          </DialogHeader>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5 post-dc-body", briefBodyClass)}>
            {modalContent ?? children}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
