import { expect, test } from "@playwright/test";
import { PASSWORD, login, loginToDashboard, logout, resetAndSeedAdmin, seedUser } from "./helpers";

test.beforeEach(async () => {
  await resetAndSeedAdmin();
  await seedUser({ email: "pat@test.local", name: "Pat Player" });
});

test.describe("account settings", () => {
  test("update display name and avatar; the new name appears after the next login", async ({ page }) => {
    await loginToDashboard(page, "pat@test.local");
    await page.goto("/settings");
    await expect(page.getByText("Logged in as pat@test.local")).toBeVisible();

    await page.getByLabel("Display name").fill("Patricia");
    await page.getByLabel("Avatar image URL").fill("https://example.com/pat.png");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText(/Saved\./)).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Display name")).toHaveValue("Patricia");
    await expect(page.getByLabel("Avatar image URL")).toHaveValue("https://example.com/pat.png");

    await logout(page);
    await loginToDashboard(page, "pat@test.local");
    await expect(page.getByRole("heading", { name: "Welcome, Patricia" })).toBeVisible();
  });

  test("changing the password checks the current one, confirms the new one, then takes effect", async ({ page }) => {
    await loginToDashboard(page, "pat@test.local");
    await page.goto("/settings");
    const change = page.getByRole("button", { name: "Change password" });
    const current = page.getByLabel("Current password");
    const next = page.getByLabel("New password", { exact: true });
    const confirm = page.getByLabel("Confirm new password");

    // Wrong current password
    await current.fill("not-my-password");
    await next.fill("BrandNew12345");
    await confirm.fill("BrandNew12345");
    await change.click();
    await expect(page.getByText("Current password is incorrect.")).toBeVisible();

    // Confirmation doesn't match
    await current.fill(PASSWORD);
    await confirm.fill("SomethingElse99");
    await change.click();
    await expect(page.getByText("New passwords don't match.")).toBeVisible();

    // Success
    await confirm.fill("BrandNew12345");
    await change.click();
    await expect(page.getByText("Password updated.")).toBeVisible();

    // The old password stops working and the new one works
    await logout(page);
    await login(page, "pat@test.local", PASSWORD);
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await loginToDashboard(page, "pat@test.local", "BrandNew12345");
    await expect(page.getByRole("heading", { name: "Welcome, Pat Player" })).toBeVisible();
  });

  test("clicking your name in the nav opens settings", async ({ page }) => {
    await loginToDashboard(page, "pat@test.local");
    await page.getByRole("link", { name: "Pat Player" }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
  });
});
