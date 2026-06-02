"use client";

import { usePathname } from "next/navigation";
import { SearchInput } from "@/components/ui/search-input";

/** Hide search on call focus pages — they use a dedicated sticky header instead. */
function isCallFocusRoute(pathname: string): boolean {
  return /^\/calls\/[^/]+(\/live|\/post-dc)?$/.test(pathname);
}

export function TopBar() {
  const pathname = usePathname();

  if (isCallFocusRoute(pathname)) {
    return null;
  }

  return (
    <header className="relative z-10 flex h-14 items-center justify-end bg-transparent px-6">
      <div className="w-full max-w-md">
        <SearchInput
          placeholder="Press ⌘K to search"
          aria-label="Search"
          className="h-9"
        />
      </div>
    </header>
  );
}
