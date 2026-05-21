import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "DC Copilot",
    template: "%s · DC Copilot",
  },
  description: "AI-native Discovery Call platform for IT services sales",
};

function AppDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
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
  const document = <AppDocument>{children}</AppDocument>;

  if (isLocalAuthBypassEnabled()) {
    return document;
  }

  return (
    <ClerkProvider>
      {document}
    </ClerkProvider>
  );
}
