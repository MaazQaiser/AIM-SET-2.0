"use client";

import { CalendarDays, Slack, Database, } from "lucide-react";
import { GoogleCalendarCard } from "./google-calendar-card";
import { IntegrationCard } from "./integration-card";
import { CalendarEventList } from "./calendar-event-list";
import { useGoogleCalendarConnection } from "@/hooks/use-google-calendar";

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022"/>
      <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00"/>
      <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF"/>
      <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900"/>
    </svg>
  );
}

export function IntegrationsTab() {
  const { data: googleConnection } = useGoogleCalendarConnection();
  const isGoogleConnected = googleConnection?.isConnected ?? false;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Section: Calendar */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Calendar
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect your calendar to auto-import client calls and pre-fill attendee details in briefs.
          </p>
        </div>

        <GoogleCalendarCard />

        <IntegrationCard
          name="Microsoft Outlook / 365"
          description="Import calls from Outlook Calendar and Teams meetings. Includes attendee sync and real-time push via Microsoft Graph webhooks."
          icon={<MicrosoftIcon />}
          status="disconnected"
          onConnect={() => alert("Microsoft Calendar integration coming soon")}
        />
      </section>

      {/* Calendar events preview (only when connected) */}
      {isGoogleConnected && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Upcoming calls from Google Calendar
          </h2>
          <CalendarEventList />
        </section>
      )}

      {/* Section: CRM */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            CRM
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Push CRM tasks and update opportunity records automatically after each call.
          </p>
        </div>

        <IntegrationCard
          name="Salesforce"
          description="Sync opportunities, contacts, and auto-create follow-up tasks. Supports HubSpot and Salesforce Bulk API for large accounts."
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M10 2C6.14 2 3 5.14 3 9c0 1.74.6 3.33 1.6 4.58L3 20l6.42-1.6A6.96 6.96 0 0 0 10 19c3.86 0 7-3.14 7-7s-3.14-7-7-7z" fill="#00A1E0"/>
            </svg>
          }
          status="disconnected"
          onConnect={() => alert("Salesforce integration coming soon")}
        />

        <IntegrationCard
          name="HubSpot"
          description="Two-way sync with HubSpot CRM — contacts, deals, and activity logging."
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="#FF7A59"/>
              <text x="6" y="16" fontSize="10" fill="white" fontWeight="bold">HS</text>
            </svg>
          }
          status="disconnected"
          onConnect={() => alert("HubSpot integration coming soon")}
        />
      </section>

      {/* Section: Messaging */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Slack className="h-4 w-4 text-muted-foreground" />
            Messaging
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receive call summaries, coaching alerts, and task notifications in Slack.
          </p>
        </div>

        <IntegrationCard
          name="Slack"
          description="Post call summaries, nudge alerts, and coaching recommendations to your Slack workspace."
          icon={<Slack className="h-5 w-5 text-[#4A154B]" />}
          status="disconnected"
          onConnect={() => alert("Slack integration coming soon")}
        />
      </section>

      {/* Env variable reminder */}
      <div className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium">To enable Google Calendar:</p>
        <p className="font-mono">GOOGLE_CLIENT_ID=your_client_id</p>
        <p className="font-mono">GOOGLE_CLIENT_SECRET=your_secret</p>
        <p className="font-mono">GOOGLE_REDIRECT_URI=http://localhost:3002/api/integrations/google/callback</p>
        <p className="font-mono">GOOGLE_WEBHOOK_SECRET=your_random_secret</p>
        <p className="mt-1">Add these to <span className="font-mono">.env.local</span> — see <span className="font-mono">.env.example</span> for the full list.</p>
      </div>
    </div>
  );
}
