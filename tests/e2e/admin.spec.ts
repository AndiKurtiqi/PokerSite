import { expect, test } from "@playwright/test";
import {
  ADMIN,
  PASSWORD,
  login,
  loginAsAdmin,
  openSessionAs,
  resetAndSeedAdmin,
  seedGame,
  seedGuest,
  seedUser,
} from "./helpers";

let adminId: string;
test.beforeEach(async () => {
  adminId = await resetAndSeedAdmin();
});

test.describe("signup requests queue", () => {
  test("approving a request lets that person in", async ({ page, browser, baseURL }) => {
    await seedUser({ email: "penny@test.local", name: "Penny Pending", status: "PENDING" });
    await loginAsAdmin(page);
    await page.goto("/admin/requests");

    const row = page.getByRole("row", { name: /Penny Pending/ });
    await expect(row).toContainText("penny@test.local");
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("No pending account requests.")).toBeVisible();

    const penny = await openSessionAs(browser, baseURL, "penny@test.local");
    await expect(penny.page.getByRole("heading", { name: "Welcome, Penny Pending" })).toBeVisible();
    await penny.context.close();
  });

  test("rejecting a request keeps that person out", async ({ page, browser, baseURL }) => {
    await seedUser({ email: "rex@test.local", name: "Rex Request", status: "PENDING" });
    await loginAsAdmin(page);
    await page.goto("/admin/requests");

    await page.getByRole("row", { name: /Rex Request/ }).getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText("No pending account requests.")).toBeVisible();

    const ctx = await browser.newContext({ baseURL });
    const rex = await ctx.newPage();
    await login(rex, "rex@test.local", PASSWORD);
    await expect(rex).toHaveURL(/\/pending/);
    await ctx.close();
  });

  test("shows an empty state when nothing is waiting", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/requests");
    await expect(page.getByText("No pending account requests.")).toBeVisible();
  });
});

test.describe("account management", () => {
  test("disabling an account locks that person out; re-enabling lets them back in", async ({
    page,
    browser,
    baseURL,
  }) => {
    await seedUser({ email: "pat@test.local", name: "Pat Player" });
    await loginAsAdmin(page);
    await page.goto("/admin/users");

    const row = page.getByTestId("user-row").filter({ hasText: "Pat Player" });
    await row.getByRole("button", { name: "Disable" }).click();
    await expect(row).toContainText("disabled");

    const ctx = await browser.newContext({ baseURL });
    const pat = await ctx.newPage();
    await login(pat, "pat@test.local", PASSWORD);
    await expect(pat.getByRole("heading", { name: "Account disabled" })).toBeVisible();
    await ctx.close();

    await row.getByRole("button", { name: "Re-enable" }).click();
    await expect(row).toContainText("approved");

    const back = await openSessionAs(browser, baseURL, "pat@test.local");
    await expect(back.page.getByRole("heading", { name: "Welcome, Pat Player" })).toBeVisible();
    await back.context.close();
  });

  test("permanent delete is only offered for accounts with no history, and asks to confirm", async ({
    page,
  }) => {
    await seedUser({ email: "clean@test.local", name: "Clean Carl" });
    const played = await seedUser({ email: "played@test.local", name: "Played Pam" });
    await seedGame({
      creatorId: adminId,
      status: "COMPLETED",
      seats: [{ userId: played, cashedOut: 20 }],
    });
    await loginAsAdmin(page);
    await page.goto("/admin/users");

    const clean = page.getByTestId("user-row").filter({ hasText: "Clean Carl" });
    const withHistory = page.getByTestId("user-row").filter({ hasText: "Played Pam" });
    await expect(withHistory.getByRole("button", { name: "Disable" })).toBeVisible();
    await expect(withHistory.getByRole("button", { name: "Delete permanently" })).toHaveCount(0);

    await clean.getByRole("button", { name: "Delete permanently" }).click();
    await clean.getByRole("button", { name: "Cancel" }).click();
    await expect(clean).toBeVisible();

    await clean.getByRole("button", { name: "Delete permanently" }).click();
    await clean.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page.getByTestId("user-row").filter({ hasText: "Clean Carl" })).toHaveCount(0);
    await expect(withHistory).toBeVisible();
  });

  // Known gap, kept as a runnable reproduction. The account's status is stored in
  // the login token when someone signs in, so disabling them doesn't affect a
  // session they already have open. test.fail() makes this pass while the gap
  // exists and fail loudly once it's fixed -- at that point, delete the line.
  test("disabling an account also ends a session that is already signed in", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.fail(true, "KNOWN GAP: disabled users keep access until their login token expires");
    await seedUser({ email: "pat@test.local", name: "Pat Player" });
    const pat = await openSessionAs(browser, baseURL, "pat@test.local");

    await loginAsAdmin(page);
    await page.goto("/admin/users");
    await page
      .getByTestId("user-row")
      .filter({ hasText: "Pat Player" })
      .getByRole("button", { name: "Disable" })
      .click();
    await expect(page.getByTestId("user-row").filter({ hasText: "Pat Player" })).toContainText("disabled");

    await pat.page.goto("/games");
    await expect(pat.page).toHaveURL(/\/pending/);
    await pat.context.close();
  });

  test("admins can't disable or delete their own account", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/users");
    const own = page.getByTestId("user-row").filter({ hasText: ADMIN.name });
    await expect(own).toContainText("you");
    await expect(own.getByRole("button")).toHaveCount(0);
  });
});

test.describe("merge guests", () => {
  test("a guest's history moves onto their new account and the guest disappears", async ({ page }) => {
    const mike = await seedGuest(adminId, "Mike");
    await seedUser({ email: "mike@test.local", name: "Mike Real" });
    for (const cashedOut of [30, 10]) {
      await seedGame({
        creatorId: adminId,
        status: "COMPLETED",
        seats: [{ guestId: mike, cashedOut }],
      });
    }
    await loginAsAdmin(page);

    // Before: the leaderboard knows him only as a guest.
    await expect(page.getByRole("row", { name: /Mike/ })).toContainText("(guest)");

    await page.goto("/admin/guests");
    const guest = page.getByTestId("guest-row").filter({ hasText: "Mike" });
    await expect(guest).toContainText("2 sessions");
    await guest.getByRole("button", { name: "Merge into account or guest..." }).click();
    await guest.getByPlaceholder("Search for the real account...").fill("mike real");
    await guest.getByRole("button", { name: "Mike Real" }).click();
    await expect(guest).toContainText("Move 2 completed sessions from guest Mike into Mike Real");
    await guest.getByRole("button", { name: "Confirm merge" }).click();
    await expect(page.getByText("No unmerged guests.")).toBeVisible();

    // After: same two sessions, now under the real account with no guest tag.
    await page.goto("/dashboard");
    const row = page.getByRole("row", { name: /Mike Real/ });
    await expect(row).toBeVisible();
    await expect(row).not.toContainText("(guest)");
    await expect(row).toContainText("2"); // sessions played
    await expect(page.getByRole("row", { name: /\(guest\)/ })).toHaveCount(0);
  });

  test("two bankers' duplicate guests can be merged into one leaderboard row", async ({ page }) => {
    const keep = await seedGuest(adminId, "Mike");
    const dupe = await seedGuest(adminId, "Mike B.");
    await seedGuest(adminId, "Totally Different");
    await seedGame({ creatorId: adminId, status: "COMPLETED", seats: [{ guestId: keep, cashedOut: 30 }] }); // +10
    await seedGame({ creatorId: adminId, status: "COMPLETED", seats: [{ guestId: dupe, cashedOut: 50 }] }); // +30
    await loginAsAdmin(page);
    await expect(page.getByRole("row", { name: /Mike/ })).toHaveCount(2);

    await page.goto("/admin/guests");
    const row = page.getByTestId("guest-row").filter({ hasText: "Mike B." });
    await row.getByRole("button", { name: "Merge into account or guest..." }).click();
    // likely matches are listed first, no typing required
    await expect(row.getByRole("button", { name: /^Mike \(guest\)/ })).toContainText("likely match");
    await row.getByRole("button", { name: /^Mike \(guest\)/ }).click();
    await expect(row).toContainText("Move 1 completed session from guest Mike B. into guest Mike");
    await row.getByRole("button", { name: "Confirm merge" }).click();
    await expect(page.getByTestId("guest-row").filter({ hasText: "Mike B." })).toHaveCount(0);

    await page.goto("/dashboard");
    const merged = page.getByRole("row", { name: /Mike/ });
    await expect(merged).toHaveCount(1);
    await expect(merged).toContainText("(guest)");
    await expect(merged).toContainText("+$40.00"); // 10 + 30 combined
  });

  test("shows an empty state when there are no guests", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/guests");
    await expect(page.getByText("No unmerged guests.")).toBeVisible();
  });
});
