"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import { cn } from "@/lib/cn";
import {
  saveCopilotFeedback,
  type CopilotFeedbackRating,
} from "@/lib/copilot/chat-feedback-store";

interface CopilotFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rating: CopilotFeedbackRating | null;
  messageId: string | null;
  response: string;
  surface?: string;
  callId?: string | null;
  onSaved: (messageId: string, rating: CopilotFeedbackRating) => void;
}

export function CopilotFeedbackDialog({
  open,
  onOpenChange,
  rating,
  messageId,
  response,
  surface,
  callId,
  onSaved,
}: CopilotFeedbackDialogProps) {
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setComment("");
      setIsSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!messageId || !rating || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await saveCopilotFeedback({
        messageId,
        rating,
        comment: comment.trim(),
        response,
        surface,
        callId,
      });
      onSaved(messageId, rating);
      toast.success("Feedback saved");
      onOpenChange(false);
    } catch {
      toast.error("Could not save feedback");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isPositive = rating === "up";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">Share feedback</DialogTitle>
            <DialogDescription>
              Help improve Copilot responses for this workflow.
            </DialogDescription>
          </DialogHeader>

          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 type-body font-medium",
              isPositive
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            )}
          >
            {isPositive ? (
              <ThumbsUp className="h-4 w-4" aria-hidden />
            ) : (
              <ThumbsDown className="h-4 w-4" aria-hidden />
            )}
            <span>{isPositive ? "Helpful" : "Needs improvement"}</span>
          </div>

          <label className="block space-y-2">
            <span className="type-body font-medium text-foreground">What should we know?</span>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a short note for the team..."
              className="min-h-28 resize-none"
            />
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!messageId || !rating}>
              Save feedback
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
