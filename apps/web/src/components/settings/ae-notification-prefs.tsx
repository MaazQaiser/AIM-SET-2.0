"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AeNotificationPrefs() {
  const [nudgesPerWindow, setNudgesPerWindow] = useState(3);
  const [quietDuringSpeech, setQuietDuringSpeech] = useState(true);
  const [roleOnly, setRoleOnly] = useState(true);
  const [objectionReminders, setObjectionReminders] = useState(false);
  const [designPatterns, setDesignPatterns] = useState(true);

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

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={quietDuringSpeech} onChange={(e) => setQuietDuringSpeech(e.target.checked)} />
          Quiet during customer speech
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={roleOnly} onChange={(e) => setRoleOnly(e.target.checked)} />
          Role-specific cues only
        </label>

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">Customize nudge types</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={objectionReminders} onChange={(e) => setObjectionReminders(e.target.checked)} />
            Objection handler reminders
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={designPatterns} onChange={(e) => setDesignPatterns(e.target.checked)} />
            Design-pattern reference surfacing (high priority)
          </label>
        </div>

        <div className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          Your previous settings led to 47 nudges across 23 calls. You acted on 19 ({acceptanceRate}% acceptance).
          Team median is {teamMedian}%. Consider raising signal threshold rather than reducing frequency.
        </div>

        <Button size="sm">Save preferences</Button>
      </CardContent>
    </Card>
  );
}
