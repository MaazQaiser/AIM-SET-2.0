"use client";

import { ExternalLink, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import type { ConnectionStatus } from "@/types/integrations";
import { cn } from "@/lib/cn";

interface IntegrationCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  status: ConnectionStatus;
  connectedEmail?: string;
  lastSyncAt?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  isLoading?: boolean;
  errorMessage?: string;
  children?: React.ReactNode;  // slot for provider-specific config UI
}

const STATUS_CONFIG: Record<ConnectionStatus, {
  label: string;
  icon: React.ElementType;
  className: string;
  dot: string;
}> = {
  connected:    { label: "Connected",    icon: CheckCircle2,  className: "text-success",            dot: "bg-success" },
  disconnected: { label: "Not connected",icon: XCircle,       className: "text-muted-foreground",   dot: "bg-muted-foreground" },
  error:        { label: "Error",        icon: AlertTriangle, className: "text-destructive",         dot: "bg-destructive" },
  syncing:      { label: "Syncing…",     icon: Loader2,       className: "text-primary animate-spin",dot: "bg-primary animate-pulse" },
};

function formatLastSync(iso?: string) {
  if (!iso) return null;
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (d < 1) return "just now";
  if (d < 60) return `${d}m ago`;
  return `${Math.floor(d / 60)}h ago`;
}

export function IntegrationCard({
  name, description, icon, status, connectedEmail,
  lastSyncAt, onConnect, onDisconnect, isLoading, errorMessage, children,
}: IntegrationCardProps) {
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;
  const isConnected = status === "connected" || status === "syncing";

  return (
    <div className={cn(
      "glass-insight-card space-y-4 p-5 shadow-none",
      isConnected && "border-primary/20"
    )}>
      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Provider icon */}
        <div className="h-10 w-10 shrink-0 rounded-lg border bg-background flex items-center justify-center">
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{name}</span>
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium", cfg.className)}>
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {connectedEmail && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Signed in as <span className="font-medium">{connectedEmail}</span>
            </p>
          )}
          {lastSyncAt && (
            <p className="text-xs text-muted-foreground">
              Last synced {formatLastSync(lastSyncAt)}
            </p>
          )}
        </div>

        {/* Action button */}
        <div className="shrink-0">
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={onDisconnect}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={onConnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <ExternalLink className="h-3 w-3" />
                  Connect
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Provider-specific config (only when connected) */}
      {isConnected && children && (
        <div className="border-t pt-4">
          {children}
        </div>
      )}
    </div>
  );
}
