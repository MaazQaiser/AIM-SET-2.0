"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@dc-copilot/ui/components/dialog";
import { Input } from "@dc-copilot/ui/components/input";
import { Label } from "@dc-copilot/ui/components/label";
import {
  createEmptyPreDcRecord,
  createSamplePreDcRecord,
  PRE_DC_FIELD_ENTRIES,
} from "@/lib/dc-notes/create-pre-dc-record";
import { slugifyCompany } from "@/lib/dc-notes/build-from-import";
import { PRE_DC_HEADERS, preDcField, type PreDCRecord } from "@/types/dc-notes";

interface AddPreDcLeadDialogProps {
  onCreated?: (record: PreDCRecord, callId: string) => void;
}

export function AddPreDcLeadDialog({ onCreated }: AddPreDcLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<PreDCRecord>(() => createSamplePreDcRecord());

  const resetForm = useCallback(() => {
    setRecord(createSamplePreDcRecord());
  }, []);

  const updateField = useCallback((header: string, value: string) => {
    setRecord((prev) => ({
      ...prev,
      fields: { ...prev.fields, [header]: value },
    }));
  }, []);

  const companyName = preDcField(record, "companyName");
  const callId = useMemo(
    () => (companyName ? slugifyCompany(companyName) : ""),
    [companyName]
  );

  const handleLoadSample = () => {
    setRecord(createSamplePreDcRecord());
    toast.message("Sample lead loaded — edit any field before saving.");
  };

  const handleClearForm = () => {
    setRecord(
      createEmptyPreDcRecord({
        companyName: companyName || undefined,
        leadName: preDcField(record, "leadName") || undefined,
        discoveryCallDatePkt: preDcField(record, "discoveryCallDatePkt") || undefined,
        discoveryCallTimePkt: preDcField(record, "discoveryCallTimePkt") || undefined,
      })
    );
    toast.message("Cleared — only company, lead, and DC date/time kept.");
  };

  const handleCreate = async () => {
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    setSaving(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch("/api/dc-notes/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "pre-dc", records: [record] }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          detail?: string | { msg: string }[];
          error?: string;
        } | null;
        const detail =
          typeof err?.detail === "string"
            ? err.detail
            : Array.isArray(err?.detail)
              ? err.detail.map((d) => d.msg).join("; ")
              : undefined;
        throw new Error(detail ?? err?.error ?? `Save failed (${res.status})`);
      }
      const body = (await res.json()) as { agent_processed?: number; agent_queued?: number };
      onCreated?.(record, callId);
      setOpen(false);
      resetForm();
      const workflowNote =
        body.agent_processed != null && body.agent_processed > 0
          ? " PRE-DC Workflow finished for this lead."
          : body.agent_queued != null && body.agent_queued > 0
            ? " PRE-DC Workflow is running in the background — refresh the Pre-call brief in a minute."
            : "";
      toast.success(`Lead saved.${workflowNote}`, {
        action: callId
          ? { label: "View call", onClick: () => window.location.assign(`/calls/${callId}`) }
          : undefined,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        toast.error(
          "Save timed out. Check that the API is running on port 8000, then try again."
        );
      } else {
        toast.error(e instanceof Error ? e.message : "Could not create lead");
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="default" size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add new lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add new Pre-DC lead</DialogTitle>
          <DialogDescription>
            Form opens with sample research you can edit. Required: company name. PRE-DC Workflow runs
            after save and shows the summary and artifacts on the Pre-DC screen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company-name">
                {PRE_DC_HEADERS.companyName} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company-name"
                value={record.fields[PRE_DC_HEADERS.companyName] ?? ""}
                onChange={(e) => updateField(PRE_DC_HEADERS.companyName, e.target.value)}
                placeholder="Acme Corp"
              />
              {callId ? (
                <p className="text-xs text-muted-foreground font-mono">Call ID: {callId}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>{PRE_DC_HEADERS.leadName}</Label>
              <Input
                value={record.fields[PRE_DC_HEADERS.leadName] ?? ""}
                onChange={(e) => updateField(PRE_DC_HEADERS.leadName, e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{PRE_DC_HEADERS.discoveryCallDatePkt}</Label>
              <Input
                value={record.fields[PRE_DC_HEADERS.discoveryCallDatePkt] ?? ""}
                onChange={(e) => updateField(PRE_DC_HEADERS.discoveryCallDatePkt, e.target.value)}
                placeholder="2026-05-22"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleLoadSample}>
              Reload sample data
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleClearForm}>
              Clear form
            </Button>
          </div>

          <div className="rounded-lg border p-3 max-h-[40vh] overflow-y-auto space-y-3">
            <p className="text-xs font-medium text-muted-foreground">All Pre-DC fields</p>
            {PRE_DC_FIELD_ENTRIES.map(({ key, header }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{header}</Label>
                <Input
                  className="h-8 text-sm"
                  value={record.fields[header] ?? ""}
                  onChange={(e) => updateField(header, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={saving || !companyName.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating…
              </>
            ) : (
              "Create new lead"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
