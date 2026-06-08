import type { Metadata } from "next";
import { Inter, Urbanist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ClerkGateProvider } from "@/components/providers/clerk-gate";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@dc-copilot/ui/components/tooltip";
import { Toaster } from "sonner";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { getClerkPublishableKey, isClerkConfigured } from "@/lib/public-env";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
});

const urbanist = Urbanist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-urbanist",
  weight: ["400", "500", "600", "700", "800"],
});

/** Avoid static prerender when Clerk env is not set at build time (Vercel). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "DC Copilot",
    template: "%s · DC Copilot",
  },
  description: "AI-native Discovery Call platform for IT services sales",
};

function AppDocument({ children }: { children: React.ReactNode }) {
  /* Official app canvas: .page-hue on body (design system — packages/ui utilities.css) */
  return (
    <html
      lang="en"
      className={`${inter.variable} ${urbanist.variable}`}
      suppressHydrationWarning
    >
      <body
        className="page-hue app-typography min-h-svh font-sans antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            {children}
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkEnabled = !isLocalAuthBypassEnabled() && isClerkConfigured();
  const publishableKey = getClerkPublishableKey();

  const document = (
    <ClerkGateProvider enabled={clerkEnabled}>
      <AppDocument>{children}</AppDocument>
    </ClerkGateProvider>
  );

  if (!clerkEnabled) {
    return document;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>{document}</ClerkProvider>
  );
}
