import { test, expect } from "@playwright/test";

test.describe("DC Copilot smoke", () => {
  test("home handles auth mode", async ({ page }) => {
    await page.goto("/");

    const clerkConfigured =
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_") &&
      process.env.CLERK_SECRET_KEY?.startsWith("sk_") &&
      process.env.NEXT_PUBLIC_AUTH_BYPASS !== "true";

    if (clerkConfigured) {
      await expect(page).toHaveURL(/sign-in/);
      return;
    }

    await expect(page.getByText("Import your leads to get started")).toBeVisible();
  });
});
