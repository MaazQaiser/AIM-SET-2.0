import { Suspense } from "react";
import { AuthSetupBanner } from "@/components/layout/auth-setup-banner";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { DashboardThemePreview } from "@/components/providers/theme-preview-provider";
import { PersonaProvider } from "@/components/providers/persona-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { DcImportsHydrator } from "@/components/settings/dc-imports-hydrator";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Avoid static prerender of dashboard pages that use Clerk client components. */
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <PersonaProvider>
        <SidebarProvider>
          <TooltipProvider delayDuration={200}>
            <DcImportsHydrator />
            <Suspense fallback={null}>
              <DashboardThemePreview>
                <div className="relative flex h-svh">
                  <Sidebar />
                  <div className="relative z-[1] flex min-w-0 flex-1 flex-col overflow-hidden pl-[calc(var(--sidebar-rail-width,64px)+1rem)]">
                    <AuthSetupBanner />
                    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
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
