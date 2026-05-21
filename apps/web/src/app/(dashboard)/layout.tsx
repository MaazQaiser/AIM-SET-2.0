import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { QueryProvider } from "@/components/providers/query-provider";
import { DcImportsHydrator } from "@/components/settings/dc-imports-hydrator";

/** Avoid static prerender of dashboard pages that use Clerk client components. */
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <DcImportsHydrator />
      <div className="page-hue flex h-svh overflow-hidden bg-background">
        <Sidebar />
        <div className="relative z-[1] flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </QueryProvider>
  );
}
