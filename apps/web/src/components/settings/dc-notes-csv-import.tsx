"use client";

import { useCallback, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Upload,
  FileSpreadsheet,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ClipboardList,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { parseDcNotesCsv } from "@/lib/dc-notes/parse-dc-csv";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { preDcField, postDcField, type PreDCRecord, type PostDCRecord } from "@/types/dc-notes";

const PRE_DC_TEMPLATE_HEADER = `Company Name-PreDC,Company Type ICP - PreDC,Annual Revenue - PreDC,No. of Employees - PreDC,Industry - PreDC,Company LinkedIn-PreDC,Company Description,Website-PreDC,Company Stage-PreDC,Company Stage,ICP Bucket,Need-PreDC,Campaign Service - PreDC,Discovery Call Time (PKT),Discovery Call Date (PKT),Prospect's Persona,Person LinkedIn-PreDC,Lead Name-PreDC`;

const POST_DC_TEMPLATE_HEADER = `Lead Stage,Reason Not A Fit - Post-DC,Bottom Line Context,Engagement Model,Sales Strategy,Additional Info,Attendees,Was Pre DC ICP bucket correct,Budget,Authority,Need,Timeline,Accounts Annual Potential,Service Line`;

const preDcColumns: ColumnDef<PreDCRecord>[] = [
  {
    id: "company",
    header: "Company",
    accessorFn: (r) => preDcField(r, "companyName"),
  },
  {
    id: "lead",
    header: "Lead",
    accessorFn: (r) => preDcField(r, "leadName"),
  },
  {
    id: "dcDate",
    header: "DC date",
    accessorFn: (r) => preDcField(r, "discoveryCallDatePkt"),
  },
  {
    id: "icp",
    header: "ICP bucket",
    accessorFn: (r) => preDcField(r, "icpBucket"),
    cell: ({ row }) => (
      <span className="text-xs line-clamp-2 max-w-[140px]">{preDcField(row.original, "icpBucket")}</span>
    ),
  },
  {
    id: "industry",
    header: "Industry",
    accessorFn: (r) => preDcField(r, "industry"),
  },
];

const postDcColumns: ColumnDef<PostDCRecord>[] = [
  {
    id: "stage",
    header: "Stage",
    accessorFn: (r) => postDcField(r, "leadStage"),
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize text-[10px]">
        {postDcField(row.original, "leadStage") || "—"}
      </Badge>
    ),
  },
  {
    id: "service",
    header: "Service",
    accessorFn: (r) => postDcField(r, "serviceLine"),
  },
  {
    id: "potential",
    header: "Potential",
    accessorFn: (r) => postDcField(r, "accountsAnnualPotential"),
  },
  {
    id: "bant",
    header: "BANT",
    cell: ({ row }) => {
      const b = postDcField(row.original, "budget");
      const a = postDcField(row.original, "authority");
      const n = postDcField(row.original, "need");
      const t = postDcField(row.original, "timeline");
      return (
        <span className="text-[10px] text-muted-foreground font-mono">
          {[b, a, n, t].filter(Boolean).join(" / ") || "—"}
        </span>
      );
    },
  },
  {
    id: "linked",
    header: "Linked call",
    cell: ({ row }) =>
      row.original.matchedCallId ? (
        <Badge variant="success" className="text-[10px]">
          Matched
        </Badge>
      ) : (
        <Badge variant="secondary" className="text-[10px]">
          Unlinked
        </Badge>
      ),
  },
];

function UploadZone({
  label,
  description,
  onFile,
}: {
  label: string;
  description: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
        dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:bg-muted/40"
      )}
    >
      <Upload className="h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function DcNotesCsvImport() {
  const {
    preDcRecords,
    postDcRecords,
    calls,
    preDcFileName,
    postDcFileName,
    importedAt,
    loadFromDb,
    clearImports,
  } = useDcImportsStore();

  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const invalidateDcQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["calls"] });
    void queryClient.invalidateQueries({ queryKey: ["call"] });
    void queryClient.invalidateQueries({ queryKey: ["call-brief"] });
    void queryClient.invalidateQueries({ queryKey: ["post-call"] });
  }, [queryClient]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Please upload a .csv file");
        return;
      }

      const text = await file.text();
      const result = parseDcNotesCsv(text);
      setParseErrors(result.errors);

      const persistToDb = async (kind: "pre-dc" | "post-dc", records: PreDCRecord[] | PostDCRecord[]) => {
        const res = await fetch("/api/dc-notes/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, records }),
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
      };

      if (result.kind === "pre-dc" && result.preDcRecords.length > 0) {
        try {
          await persistToDb("pre-dc", result.preDcRecords);
          await loadFromDb();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not save to Supabase");
          return;
        }
        invalidateDcQueries();
        toast.success(`Imported ${result.preDcRecords.length} leads to Supabase (vector-indexed)`);
        if (result.errors.length) toast.warning(`${result.errors.length} row warning(s)`);
        return;
      }

      if (result.kind === "post-dc" && result.postDcRecords.length > 0) {
        try {
          await persistToDb("post-dc", result.postDcRecords);
          await loadFromDb();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not save to Supabase");
          return;
        }
        invalidateDcQueries();
        const matched = useDcImportsStore
          .getState()
          .postDcRecords.filter((r) => r.matchedCallId).length;
        toast.success(
          `Imported ${result.postDcRecords.length} Post-DC notes to Supabase (${matched} linked to calls)`
        );
        return;
      }

      toast.error(result.errors[0] ?? "Could not parse CSV — check column headers");
    },
    [loadFromDb, invalidateDcQueries]
  );

  const downloadTemplate = (kind: "pre" | "post") => {
    const header = kind === "pre" ? PRE_DC_TEMPLATE_HEADER : POST_DC_TEMPLATE_HEADER;
    const blob = new Blob([`${header}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = kind === "pre" ? "pre_dc_notes_data.csv" : "post_dc_notes_data.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Discovery call data import
        </CardTitle>
        <CardDescription>
          Upload Pre-DC and Post-DC CSVs — records are stored in Supabase and embedded into the vector
          index for agent retrieval.
          {process.env.NEXT_PUBLIC_KB_SHARED === "true" && (
            <span className="block mt-1 text-primary/90">
              Shared team dataset — every signed-in user sees the same imported calls and notes.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <UploadZone
            label="Pre-DC notes CSV"
            description="Format: pre_dc_notes_data.csv — company research, ICP, discovery date/time, lead contact."
            onFile={handleFile}
          />
          <UploadZone
            label="Post-DC notes CSV"
            description="Format: post_dc_notes_data.csv — lead stage, bottom line, BANT, sales strategy, service line."
            onFile={handleFile}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate("pre")}>
            <Download className="h-3.5 w-3.5" />
            Pre-DC template
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate("post")}>
            <Download className="h-3.5 w-3.5" />
            Post-DC template
          </Button>
          {(preDcRecords.length > 0 || postDcRecords.length > 0) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                clearImports();
                invalidateDcQueries();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all imports
            </Button>
          )}
        </div>

        {parseErrors.length > 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 space-y-1">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Import warnings
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {parseErrors.slice(0, 6).map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {(preDcFileName || postDcFileName) && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {preDcFileName && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                Pre-DC: {preDcFileName} ({preDcRecords.length} rows)
              </span>
            )}
            {postDcFileName && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                Post-DC: {postDcFileName} ({postDcRecords.length} rows)
              </span>
            )}
            {importedAt && <span>· Updated {new Date(importedAt).toLocaleString()}</span>}
            {calls.length > 0 && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {calls.length} calls on home calendar
              </span>
            )}
          </div>
        )}

        {(preDcRecords.length > 0 || postDcRecords.length > 0) && (
          <Tabs defaultValue={preDcRecords.length > 0 ? "pre" : "post"}>
            <TabsList>
              <TabsTrigger value="pre" disabled={preDcRecords.length === 0}>
                Pre-DC ({preDcRecords.length})
              </TabsTrigger>
              <TabsTrigger value="post" disabled={postDcRecords.length === 0}>
                Post-DC ({postDcRecords.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="pre" className="mt-4">
              <DataTable
                columns={preDcColumns}
                data={preDcRecords}
                searchKey="company"
                searchPlaceholder="Search companies..."
                pageSize={6}
              />
            </TabsContent>
            <TabsContent value="post" className="mt-4">
              <DataTable
                columns={postDcColumns}
                data={postDcRecords}
                searchKey="stage"
                searchPlaceholder="Filter by stage..."
                pageSize={6}
              />
            </TabsContent>
          </Tabs>
        )}

        {preDcRecords.length === 0 && postDcRecords.length === 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <ClipboardList className="h-3.5 w-3.5" />
            Tip: import Pre-DC first so Post-DC rows can auto-link to companies mentioned in the notes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
