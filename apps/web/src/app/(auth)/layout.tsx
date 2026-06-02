import { AuthBrandPanel } from "@/components/auth/auth-page-shell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-hue min-h-svh">
      <div className="mx-auto grid min-h-svh w-full max-w-6xl grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <AuthBrandPanel className="border-b border-border lg:border-b-0 lg:border-r" />
        {children}
      </div>
    </div>
  );
}
