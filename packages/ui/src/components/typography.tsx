import * as React from "react";
import { cn } from "../lib/cn";

export type TypographyVariant =
  | "display"
  | "headline"
  | "title"
  | "subtitle"
  | "body"
  | "body-sm"
  | "label"
  | "caption"
  | "mono";

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  variant?: TypographyVariant;
  muted?: boolean;
}

const defaultElementByVariant: Record<TypographyVariant, React.ElementType> = {
  display: "h1",
  headline: "h1",
  title: "h2",
  subtitle: "p",
  body: "p",
  "body-sm": "p",
  label: "span",
  caption: "span",
  mono: "code",
};

const typographyVariants: Record<TypographyVariant, string> = {
  display: "type-display",
  headline: "type-headline",
  title: "type-title",
  subtitle: "type-subtitle",
  body: "type-body",
  "body-sm": "type-body-sm",
  label: "type-label",
  caption: "type-caption",
  mono: "type-mono",
};

export const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ as, variant = "body", muted = false, className, ...props }, ref) => {
    const Component = as ?? defaultElementByVariant[variant];

    return (
      <Component
        ref={ref}
        className={cn(typographyVariants[variant], muted && "text-muted-foreground", className)}
        {...props}
      />
    );
  }
);
Typography.displayName = "Typography";

export function Display(props: Omit<TypographyProps, "variant">) {
  return <Typography variant="display" {...props} />;
}

export function Headline(props: Omit<TypographyProps, "variant">) {
  return <Typography variant="headline" {...props} />;
}

export function Title(props: Omit<TypographyProps, "variant">) {
  return <Typography variant="title" {...props} />;
}

export function Text(props: Omit<TypographyProps, "variant">) {
  return <Typography variant="body" {...props} />;
}

export function Caption(props: Omit<TypographyProps, "variant">) {
  return <Typography variant="caption" {...props} />;
}
