"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { BotChatPanel } from "@/components/bot-chat-panel";

type GlobalSurface = "home" | "knowledge" | "content" | "agents" | "settings" | "global";

function surfaceFromPath(pathname: string): GlobalSurface {
  if (pathname.startsWith("/knowledge")) return "knowledge";
  if (pathname.startsWith("/content")) return "content";
  if (pathname.startsWith("/agents")) return "agents";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname === "/home" || pathname.startsWith("/calls")) return "home";
  return "global";
}

/**
 * Extract entity IDs and a human-readable screen description from the current
 * pathname so the copilot backend can load the specific entity being viewed
 * instead of only receiving a coarse surface label.
 */
function contextFromPath(pathname: string): Record<string, string> {
  const ctx: Record<string, string> = { pagePath: pathname };

  // /knowledge/[assetId] or /knowledge/[assetId]/...
  const knowledgeAsset = pathname.match(/^\/knowledge\/([^/?#]+)/);
  if (knowledgeAsset) {
    ctx.assetId = knowledgeAsset[1];
    ctx.currentScreen = `Knowledge asset: ${knowledgeAsset[1]}`;
  } else if (pathname.startsWith("/knowledge")) {
    ctx.currentScreen = "Knowledge base library";
  }

  // /content/[projectId] or /content/[projectId]/...
  const contentProject = pathname.match(/^\/content\/([^/?#]+)/);
  if (contentProject) {
    ctx.projectId = contentProject[1];
    ctx.currentScreen = `Content project: ${contentProject[1]}`;
  } else if (pathname.startsWith("/content")) {
    ctx.currentScreen = "Content studio library";
  }

  // /agents/[agentId] or /agents/[agentId]/...
  const agentPage = pathname.match(/^\/agents\/([^/?#]+)/);
  if (agentPage) {
    ctx.agentId = agentPage[1];
    ctx.currentScreen = `Agent: ${agentPage[1]}`;
  } else if (pathname.startsWith("/agents")) {
    ctx.currentScreen = "Agents dashboard";
  }

  // /settings/[section]
  const settingsSection = pathname.match(/^\/settings\/([^/?#]+)/);
  if (settingsSection) {
    ctx.settingsSection = settingsSection[1];
    ctx.currentScreen = `Settings: ${settingsSection[1]}`;
  } else if (pathname.startsWith("/settings")) {
    ctx.currentScreen = "Settings";
  }

  // home / calls list
  if (pathname === "/home" || pathname === "/calls" || pathname.startsWith("/calls?")) {
    ctx.currentScreen = "Home dashboard";
  }

  return ctx;
}

export function GlobalCopilotDock() {
  const pathname = usePathname() ?? "/";

  const isCallWorkspace = /^\/calls\/[^/]+/.test(pathname);
  const surface = useMemo(() => surfaceFromPath(pathname), [pathname]);
  const context = useMemo(() => contextFromPath(pathname), [pathname]);

  if (isCallWorkspace) return null;

  return (
    <BotChatPanel
      callId={`global-${surface}`}
      apiCallId={null}
      variant="floating"
      phase="prep"
      surface={surface}
      context={context}
      copilotOnly
    />
  );
}
