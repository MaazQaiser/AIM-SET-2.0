"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../lib/cn";

type TabsVariant = "underline" | "pill" | "glass";

const TabsVariantContext = React.createContext<TabsVariant>("underline");

interface TabsRootProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> {
  variant?: TabsVariant;
}

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsRootProps
>(({ variant = "underline", ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.Root ref={ref} {...props} />
  </TabsVariantContext.Provider>
));
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "flex w-full max-w-full items-center overflow-x-auto text-muted-foreground",
        variant === "underline" &&
          "h-10 gap-6 border-b border-border/60 bg-transparent",
        variant === "pill" &&
          "h-10 gap-1 rounded-full bg-muted/60 p-1 shadow-soft-xs",
        variant === "glass" &&
          "glass h-10 gap-1 rounded-full p-1",
        className
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap type-nav ring-offset-background transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "underline" && [
          "relative h-10 border-b-2 border-transparent px-0 pb-2 pt-1 text-muted-foreground",
          "hover:text-foreground",
          "data-[state=active]:border-foreground data-[state=active]:text-foreground",
        ],
        variant === "pill" && [
          "h-8 rounded-full px-4 text-muted-foreground",
          "hover:text-foreground",
          "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-soft-sm",
        ],
        variant === "glass" && [
          "h-8 rounded-full px-4 text-muted-foreground",
          "hover:text-foreground",
          "data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-soft-sm",
        ],
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
export type { TabsVariant };
