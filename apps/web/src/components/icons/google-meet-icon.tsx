import { cn } from "@/lib/cn";

/** Google Meet mark (simplified four-color tile). */
export function GoogleMeetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-4 w-4", className)} aria-hidden>
      <path fill="#00832D" d="M6 5h6v6H6z" />
      <path fill="#0066DA" d="M12 5h6v6h-6z" />
      <path fill="#E94235" d="M6 11h6v6H6z" />
      <path fill="#FFBA00" d="M12 11h6v6h-6z" />
    </svg>
  );
}
