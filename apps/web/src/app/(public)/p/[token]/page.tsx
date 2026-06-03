"use client";

import { use, useCallback, useEffect, useState } from "react";
import { ClpPublicView } from "@/components/landing-page/clp-public-view";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import type { ClpChatMessage, ClpComment, ClpProposal, CustomerLandingPage } from "@dc-copilot/types";

interface PageParams {
  params: Promise<{ token: string }>;
}

type GateStep = "password" | "identity" | "content";

export default function PublicLandingPage({ params }: PageParams) {
  const { token } = use(params);
  const [step, setStep] = useState<GateStep>("password");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<{
    page: CustomerLandingPage;
    proposal?: ClpProposal | null;
    comments?: ClpComment[];
  } | null>(null);
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [chat, setChat] = useState<ClpChatMessage[]>([]);

  const postPublic = useCallback(
    async (action: string, body: Record<string, unknown>) => {
      const res = await fetch(`/api/public/clp/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload: body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Request failed");
      }
      return res.json();
    },
    [token]
  );

  const track = useCallback(
    async (eventType: string, extra?: Record<string, unknown>) => {
      try {
        await postPublic("events", {
          events: [{ eventType, payload: extra ?? {} }],
          visitorId,
          sessionId,
        });
      } catch {
        /* non-blocking */
      }
    },
    [postPublic, visitorId, sessionId]
  );

  async function loadContent() {
    const res = await fetch(`/api/public/clp/${token}`);
    if (!res.ok) throw new Error("Page not found");
    const data = await res.json();
    setPayload(data);
    setStep("content");
    void track("page_view");
  }

  async function submitPassword() {
    setError("");
    try {
      await postPublic("auth", { password });
      setStep("identity");
    } catch {
      setError("Invalid password");
    }
  }

  async function submitIdentity() {
    setError("");
    try {
      const data = await postPublic("identify", { name, email });
      setVisitorId(data.visitor?.id ?? "");
      setSessionId(data.session?.id ?? "");
      await loadContent();
    } catch {
      setError("Could not verify identity");
    }
  }

  const loadChat = useCallback(async () => {
    if (!visitorId) return;
    const res = await fetch(`/api/public/clp/${token}?chat=1&visitorId=${encodeURIComponent(visitorId)}`);
    if (res.ok) {
      const msgs = (await res.json()) as ClpChatMessage[];
      setChat(msgs);
    }
  }, [token, visitorId]);

  useEffect(() => {
    if (step === "content" && visitorId) {
      void loadChat();
      const t = setInterval(() => void loadChat(), 10000);
      return () => clearInterval(t);
    }
  }, [step, visitorId, loadChat]);

  if (step === "password") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
          <h1 className="text-lg font-semibold">Enter password</h1>
          <p className="text-sm text-muted-foreground">This page is shared privately with you.</p>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={() => void submitPassword()}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (step === "identity") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
          <h1 className="text-lg font-semibold">Welcome</h1>
          <p className="text-xs text-muted-foreground">
            Your activity on this page may be shared with your account team to support our
            conversation.
          </p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Work email"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={() => void submitIdentity()}>
            View landing page
          </Button>
        </div>
      </div>
    );
  }

  if (!payload?.page) return null;

  return (
    <ClpPublicView
      page={payload.page}
      proposal={payload.proposal}
      comments={payload.comments}
      chatMessages={chat}
      onDocumentOpen={(assetId) => void track("document_opened", { assetId })}
      onProposalOpen={() => void track("proposal_opened")}
      onSendChat={async (body) => {
        await postPublic("chat", {
          visitorId,
          sessionId,
          authorName: name,
          body,
        });
        setChat((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            landingPageId: payload.page.id,
            visitorId,
            authorType: "visitor",
            authorName: name,
            body,
            createdAt: new Date().toISOString(),
          },
        ]);
      }}
      onAddComment={async (sectionId, body) => {
        await postPublic("comments", {
          sectionId,
          body,
          visitorId,
          authorName: name,
        });
      }}
    />
  );
}
