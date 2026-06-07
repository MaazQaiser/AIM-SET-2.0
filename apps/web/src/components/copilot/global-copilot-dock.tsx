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
  if (pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/calls")) return "home";
  return "global";
}

export function GlobalCopilotDock() {
  const pathname = usePathname() ?? "/";

  const isCallWorkspace = /^\/calls\/[^/]+/.test(pathname);
  const surface = useMemo(() => surfaceFromPath(pathname), [pathname]);

  if (isCallWorkspace) return null;

  return (
    <BotChatPanel
      callId={`global-${surface}`}
      apiCallId={null}
      variant="floating"
      phase="prep"
      surface={surface}
      context={{ pagePath: pathname }}
      copilotOnly
    />
  );
}
