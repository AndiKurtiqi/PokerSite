import { expect, test } from "@playwright/test";
import {
  ADMIN,
  PASSWORD,
  login,
  loginAsAdmin,
  loginToDashboard,
  logout,
  openSessionAs,
  resetAndSeedAdmin,
  seedUser,
} from "./helpers";

test.beforeEach(resetAndSeedAdmin);

test.describe("login and logout", () => {
  test("logged-out visitors are sent to the login page", async ({ page }) => {
    for (const path of ["/dashboard", "/games", "/friends", "/leaderboard", "/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("admin can log in, sees the admin links, and can log out", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("heading", { name: `Welcome, ${ADMIN.name}` })).toBeVisible();
    for (const link of ["Requests", "Merge Guests", "Accounts"]) {
      await expect(page.getByRole("link", { name: link })).toBeVisible();
    }

    await logout(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a wrong password shows an error and stays on the login page", async ({ page }) => {
    await login(page, ADMIN.email, "definitely-wrong");
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("an unknown email gets the same generic error", async ({ page }) => {
    await login(page, "nobody@test.local", PASSWORD);
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
  });

  test("a logged-in user visiting /login is sent to the dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("roles", () => {
  test("a regular player has no admin links and is bounced from admin pages", async ({ page }) => {
    await seedUser({ email: "pat@test.local", name: "Pat Player" });
    await loginToDashboard(page, "pat@test.local");

    for (const link of ["Requests", "Merge Guests", "Accounts"]) {
      await expect(page.getByRole("link", { name: link })).toHaveCount(0);
    }
    for (const path of ["/admin/requests", "/admin/users", "/admin/guests"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });
});

test.describe("signup and approval", () => {
  test("a new signup waits for approval, then can use the app", async ({ page, browser, baseURL }) => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("New Newman");
    await page.getByLabel("Email").fill("new@test.local");
    await page.getByLabel("Password").fill("NewPass12345");
    await page.getByRole("button", { name: "Request account" }).click();
    await expect(page).toHaveURL(/\/login/);

    // They can sign in, but are held on the waiting page and can't reach the app.
    await login(page, "new@test.local", "NewPass12345");
    await expect(page).toHaveURL(/\/pending/);
    await expect(page.getByRole("heading", { name: "Awaiting approval" })).toBeVisible();
    await page.goto("/games");
    await expect(page).toHaveURL(/\/pending/);

    // The admin approves them from the Requests queue in a separate session.
    const admin = await openSessionAs(browser, baseURL, ADMIN.email, ADMIN.password);
    await admin.page.goto("/admin/requests");
    const row = admin.page.getByRole("row", { name: /New Newman/ });
    await expect(row).toContainText("new@test.local");
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(admin.page.getByText("No pending account requests.")).toBeVisible();
    await admin.context.close();

    // Their login token still says "pending", so they sign in again to pick up the approval.
    await logout(page);
    await loginToDashboard(page, "new@test.local", "NewPass12345");
    await expect(page.getByRole("heading", { name: "Welcome, New Newman" })).toBeVisible();
  });

  test("signing up with an existing email shows an error", async ({ page }) => {
    await seedUser({ email: "taken@test.local", name: "Taken" });
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Copycat");
    await page.getByLabel("Email").fill("taken@test.local");
    await page.getByLabel("Password").fill("LongEnough123");
    await page.getByRole("button", { name: "Request account" }).click();
    await expect(page.getByText("An account with that email already exists.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("a disabled account is told so and can't use the app", async ({ page }) => {
    await seedUser({ email: "dee@test.local", name: "Dee Disabled", status: "DISABLED" });
    await login(page, "dee@test.local", PASSWORD);
    await expect(page).toHaveURL(/\/pending/);
    await expect(page.getByRole("heading", { name: "Account disabled" })).toBeVisible();
    await page.goto("/games");
    await expect(page).toHaveURL(/\/pending/);
  });

  test("a rejected account can't reach the app", async ({ page }) => {
    await seedUser({ email: "rex@test.local", name: "Rex Rejected", status: "REJECTED" });
    await login(page, "rex@test.local", PASSWORD);
    await expect(page).toHaveURL(/\/pending/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/pending/);
  });
});
