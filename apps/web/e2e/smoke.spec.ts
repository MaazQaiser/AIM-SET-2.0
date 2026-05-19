import { test, expect } from "@playwright/test";

test.describe("DC Copilot smoke", () => {
  test("home redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/sign-in/);
  });
});
