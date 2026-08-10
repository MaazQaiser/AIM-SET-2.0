import { GlobalCopilotDock } from "@/components/copilot/global-copilot-dock";
import { AuthSetupBanner } from "@/components/layout/auth-setup-banner";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { DashboardDataWarmup } from "@/components/providers/dashboard-data-warmup";
import { PersonaProvider } from "@/components/providers/persona-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { DashboardThemePreview } from "@/components/providers/theme-preview-provider";
import { DcImportsHydrator } from "@/components/settings/dc-imports-hydrator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense } from "react";

/** Avoid static prerender of dashboard pages that use Clerk client components. */
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <PersonaProvider>
        <SidebarProvider>
          <TooltipProvider delayDuration={200}>
            <DcImportsHydrator />
            <DashboardDataWarmup />
            <Suspense fallback={null}>
              <DashboardThemePreview>
                <div className="relative flex h-svh overflow-hidden">
                  <div data-dashboard-sidebar>
                    <Sidebar />
                  </div>
                  <div
                    data-dashboard-content
                    className="relative z-[1] flex min-w-0 flex-1 flex-col overflow-hidden pl-[calc(var(--sidebar-rail-width,64px)+1rem)]"
                  >
                    <AuthSetupBanner />
                    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
                      {children}
                    </main>
                  </div>
                  <div data-global-copilot-dock>
                    <GlobalCopilotDock />
                  </div>
                </div>
              </DashboardThemePreview>
            </Suspense>
          </TooltipProvider>
        </SidebarProvider>
      </PersonaProvider>
    </QueryProvider>
  );
}
