import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  [
    "group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium",
    "transition-[background-color,box-shadow,transform,color,border-color] duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-soft-sm hover:bg-primary/90 hover:shadow-soft",
        dark:
          "bg-foreground text-background shadow-soft-sm hover:bg-foreground/90 hover:shadow-soft",
        secondary:
          "bg-secondary text-secondary-foreground shadow-soft-sm hover:bg-secondary/80 hover:shadow-soft",
        destructive:
          "bg-destructive text-destructive-foreground shadow-soft-sm hover:bg-destructive/90 hover:shadow-soft",
        outline:
          "border border-border/60 bg-background text-foreground shadow-soft-xs hover:bg-accent hover:text-accent-foreground hover:border-border hover:shadow-soft-sm",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground",
        glass:
          "glass text-foreground hover:bg-white/80 hover:shadow-soft dark:hover:bg-white/10",
        link:
          "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-sm",
        icon: "h-9 w-9 text-sm",
        "icon-sm": "h-8 w-8 text-xs",
        "icon-lg": "h-11 w-11 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
