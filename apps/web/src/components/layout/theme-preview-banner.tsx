"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";

export function ThemePreviewBanner() {
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (dismissed) return null;

  const params = new URLSearchParams(searchParams.toString());
  params.delete("theme");
  const defaultHref = params.toString() ? `${pathname}?${params.toString()}` : pathname;

  return (
    <div
      className="relative z-[2] flex shrink-0 items-center justify-between gap-3 border-b border-[#d3cec6] bg-white px-4 py-2 text-sm text-[#626260]"
      role="status"
    >
      <p>
        <span className="font-medium text-[#111111]">Intercom design preview</span>
        {" — "}
        white canvas, hairline cards, Fin Orange for AI. Compare with the default theme.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button asChild variant="outline" size="sm" className="h-7 text-xs border-[#d3cec6] bg-white">
          <Link href={defaultHref}>Exit preview</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss preview banner"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
