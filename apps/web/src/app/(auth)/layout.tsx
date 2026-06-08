import { AuthBrandPanel } from "@/components/auth/auth-page-shell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-svh bg-[#FEFCF8] text-[#1A1A18]">
      <div className="mx-auto grid min-h-svh w-full max-w-6xl grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <AuthBrandPanel className="border-b border-[rgba(26,26,24,0.1)] lg:border-b-0 lg:border-r" />
        {children}
      </div>
    </div>
  );
}
