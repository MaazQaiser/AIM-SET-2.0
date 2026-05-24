import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const chipVariants = cva(
  "inline-flex items-center justify-center rounded-full font-medium transition-colors",
  {
    variants: {
      variant: {
        tag: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
        muted: "bg-muted/60 text-muted-foreground",
      },
      size: {
        sm: "h-6 px-2.5 text-[11px]",
        md: "h-7 px-3 text-xs",
      },
    },
    defaultVariants: {
      variant: "tag",
      size: "sm",
    },
  }
);

const filterChipVariants = cva(
  "inline-flex h-8 shrink-0 items-center justify-center rounded-full px-3.5 text-xs font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      active: {
        true: "bg-primary text-primary-foreground shadow-card",
        false:
          "bg-white/70 text-muted-foreground hover:bg-primary/10 hover:text-primary dark:bg-white/10 dark:hover:bg-primary/15",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

function Chip({ className, variant, size, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ variant, size }), className)} {...props} />;
}

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

function FilterChip({ className, active = false, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(filterChipVariants({ active }), className)}
      {...props}
    >
      {children}
    </button>
  );
}

export { Chip, FilterChip, chipVariants, filterChipVariants };
