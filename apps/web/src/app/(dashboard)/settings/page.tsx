import { Users, FileSpreadsheet, Plug } from "lucide-react";
import type { Metadata } from "next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { AeNotificationPrefs } from "@/components/settings/ae-notification-prefs";
import { DcNotesCsvImport } from "@/components/settings/dc-notes-csv-import";
import { IntegrationsTab } from "@/components/integrations/integrations-tab";
import Link from "next/link";

export const metadata: Metadata = { title: "Settings" };

interface MemberRow {
  name: string;
  email: string;
  role: string;
  status: string;
}

const members: MemberRow[] = [
  { name: "Sarah Mendes", email: "sarah@company.com", role: "Account Executive", status: "Active" },
  { name: "Tariq Ali", email: "tariq@company.com", role: "Solutions Engineer", status: "Active" },
  { name: "Priya Raman", email: "priya@company.com", role: "Designer", status: "Active" },
];

const memberColumns: ColumnDef<MemberRow>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "role", header: "Role" },
  { accessorKey: "status", header: "Status" },
];

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Team and personal preferences ·{" "}
          <Link href="/governance" className="text-primary hover:underline">
            Governance &amp; AI cost →
          </Link>
        </p>
      </div>

      <Tabs defaultValue="integrations">
        <TabsList>
          <TabsTrigger value="integrations" className="gap-1.5">
            <Plug className="h-3.5 w-3.5" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Team
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Data import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="mt-4">
          <IntegrationsTab />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <AeNotificationPrefs />
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <DcNotesCsvImport />
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Team members</CardTitle>
              <CardDescription>Manage roles and access</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={memberColumns} data={members} searchKey="name" searchPlaceholder="Search by name..." />
              <div className="mt-4">
                <Button variant="outline" size="sm">
                  Invite member
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
