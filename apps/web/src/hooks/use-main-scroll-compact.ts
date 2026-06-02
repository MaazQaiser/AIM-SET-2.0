"use client";

import { useEffect, useState } from "react";

/** True when the dashboard `<main>` scroll position passes the threshold. */
export function useMainScrollCompact(threshold = 72): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    const onScroll = () => setCompact(main.scrollTop > threshold);
    onScroll();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return compact;
}
