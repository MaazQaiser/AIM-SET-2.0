/** Clerk UI aligned with platform tokens (Urbanist, cream canvas, hairline cards). */
export const clerkAppearance = {
  variables: {
    colorPrimary: "hsl(220 12% 22%)",
    colorText: "hsl(220 10% 20%)",
    colorTextSecondary: "hsl(220 9% 46%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInputBackground: "hsl(0 0% 100%)",
    colorInputText: "hsl(220 10% 20%)",
    colorNeutral: "hsl(220 13% 86%)",
    colorDanger: "hsl(0 65% 55%)",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-urbanist), ui-sans-serif, system-ui, sans-serif",
    fontSize: "0.875rem",
  },
  layout: {
    socialButtonsPlacement: "top" as const,
    shimmer: false,
  },
  elements: {
    rootBox: "w-full",
    card: "shadow-none rounded-xl border border-border bg-card w-full",
    cardBox: "shadow-none gap-5",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    main: "gap-4",
    form: "gap-4",
    formFieldRow: "gap-2",
    formFieldLabel: "text-xs font-semibold text-foreground",
    formFieldInput:
      "rounded-lg border-border bg-background text-sm shadow-none h-10 focus:ring-1 focus:ring-ring",
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium shadow-none h-10",
    formButtonReset:
      "text-muted-foreground hover:text-foreground text-sm",
    socialButtonsBlockButton:
      "border border-border bg-card text-foreground hover:bg-accent rounded-lg shadow-none h-10",
    socialButtonsBlockButtonText: "text-sm font-medium",
    footerActionLink: "text-primary font-medium hover:text-primary/80",
    footerActionText: "text-sm text-muted-foreground",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground text-xs uppercase tracking-wide",
    identityPreview: "border border-border rounded-lg bg-muted/20",
    identityPreviewText: "text-sm font-medium text-foreground",
    identityPreviewEditButton: "text-primary text-sm",
    formFieldInputShowPasswordButton: "text-muted-foreground",
    footer: "bg-transparent pt-2",
    alert: "rounded-lg border border-border bg-muted/30 text-sm",
    alertText: "text-foreground",
    otpCodeFieldInput: "rounded-lg border-border shadow-none",
    formResendCodeLink: "text-primary text-sm",
  },
};
