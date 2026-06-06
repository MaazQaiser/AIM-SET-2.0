import { cn } from "@/lib/cn";

interface BrandIconProps {
  className?: string;
}

/** Gmail mark — multicolor envelope. */
export function GmailIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <path
        fill="#EA4335"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#4285F4"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/** Jira mark — blue diamond. */
export function JiraIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <path
        fill="#2684FF"
        d="M11.53 2c0 2.4 1.97 4.35 4.37 4.35h.17v-.17c0-2.4 1.97-4.35 4.35-4.35H11.53z"
      />
      <path
        fill="#2684FF"
        d="M6.75 7.28c0 2.4 1.97 4.35 4.35 4.35h.17V11.5a4.353 4.353 0 0 0-4.35-4.22H6.75z"
      />
      <path
        fill="#2684FF"
        d="M2 12.58a4.353 4.353 0 0 0 4.22 4.22v.17c-2.4 0-4.35 1.97-4.35 4.35V12.58z"
      />
      <path
        fill="#0052CC"
        d="M11.53 22c-2.4 0-4.35-1.97-4.35-4.35v-.17h.17c2.4 0 4.35-1.97 4.35-4.35h4.35C16.05 18.6 14.1 22 11.53 22z"
      />
      <path
        fill="#0052CC"
        d="M16.32 16.73c-2.4 0-4.35-1.97-4.35-4.35v-.17h.17c2.4 0 4.35-1.97 4.35-4.35h4.35c0 4.05-2.02 7.35-4.52 8.87z"
      />
      <path
        fill="#0052CC"
        d="M21.07 12.03c-2.4 0-4.35-1.97-4.35-4.35v-.17h.17c2.4 0 4.35-1.97 4.35-4.35H24c0 4.05-2.02 7.35-4.52 8.87-.98.62-2.12.98-3.41.98z"
      />
    </svg>
  );
}
