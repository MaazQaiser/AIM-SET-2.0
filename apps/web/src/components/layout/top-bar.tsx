import { SearchInput } from "@/components/ui/search-input";

export function TopBar() {
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
