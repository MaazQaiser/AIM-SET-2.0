import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "../lib/cn";

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, wrapperClassName, ...props }, ref) => (
    <div className={cn("relative w-full", wrapperClassName)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        ref={ref}
        type="search"
        className={cn(
          "glass h-8 w-full rounded-full border-0 pl-9 pr-4 type-body text-foreground",
          "placeholder:text-muted-foreground",
          "transition-[box-shadow,background-color] duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[&::-webkit-search-cancel-button]:appearance-none",
          className
        )}
        {...props}
      />
    </div>
  )
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
