"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Label } from "@dc-copilot/ui/components/label";
import { Slider } from "@dc-copilot/ui/components/slider";
import { Button } from "@dc-copilot/ui/components/button";
import { Separator } from "@dc-copilot/ui/components/separator";

export function AeNotificationPrefs() {
  const [nudgesPerWindow, setNudgesPerWindow] = useState(3);
  const [quietDuringSpeech, setQuietDuringSpeech] = useState(true);
  const [roleOnly, setRoleOnly] = useState(true);
  const [objectionReminders, setObjectionReminders] = useState(false);
  const [designPatterns, setDesignPatterns] = useState(true);
  const [clpFirstVisit, setClpFirstVisit] = useState(true);
  const [clpProposalOpen, setClpProposalOpen] = useState(true);
  const [clpChat, setClpChat] = useState(true);
  const [clpComments, setClpComments] = useState(true);

  const acceptanceRate = 40;
  const teamMedian = 54;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Nudge frequency and role-specific cues during calls</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Nudges per 5 minutes: {nudgesPerWindow}</Label>
          <Slider
            value={[nudgesPerWindow]}
            onValueChange={([v]) => setNudgesPerWindow(v)}
            min={1}
            max={5}
            step={1}
          />
        </div>

        <label className="flex items-center gap-2 type-body cursor-pointer">
          <input type="checkbox" checked={quietDuringSpeech} onChange={(e) => setQuietDuringSpeech(e.target.checked)} />
          Quiet during customer speech
        </label>
        <label className="flex items-center gap-2 type-body cursor-pointer">
          <input type="checkbox" checked={roleOnly} onChange={(e) => setRoleOnly(e.target.checked)} />
          Role-specific cues only
        </label>

        <Separator />

        <div className="space-y-2">
          <p className="type-body font-medium">Customer landing page</p>
          <label className="flex items-center gap-2 type-body">
            <input type="checkbox" checked={clpFirstVisit} onChange={(e) => setClpFirstVisit(e.target.checked)} />
            First visitor on a published page
          </label>
          <label className="flex items-center gap-2 type-body">
            <input type="checkbox" checked={clpProposalOpen} onChange={(e) => setClpProposalOpen(e.target.checked)} />
            Proposal opened
          </label>
          <label className="flex items-center gap-2 type-body">
            <input type="checkbox" checked={clpChat} onChange={(e) => setClpChat(e.target.checked)} />
            New chat message
          </label>
          <label className="flex items-center gap-2 type-body">
            <input type="checkbox" checked={clpComments} onChange={(e) => setClpComments(e.target.checked)} />
            New comment
          </label>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="type-body font-medium">Customize nudge types</p>
          <label className="flex items-center gap-2 type-body">
            <input type="checkbox" checked={objectionReminders} onChange={(e) => setObjectionReminders(e.target.checked)} />
            Objection handler reminders
          </label>
          <label className="flex items-center gap-2 type-body">
            <input type="checkbox" checked={designPatterns} onChange={(e) => setDesignPatterns(e.target.checked)} />
            Design-pattern reference surfacing (high priority)
          </label>
        </div>

        <div className="rounded-md border border-dashed bg-muted/40 p-3 type-caption text-muted-foreground">
          Your previous settings led to 47 nudges across 23 calls. You acted on 19 ({acceptanceRate}% acceptance).
          Team median is {teamMedian}%. Consider raising signal threshold rather than reducing frequency.
        </div>

        <Button size="sm">Save preferences</Button>
      </CardContent>
    </Card>
  );
}
