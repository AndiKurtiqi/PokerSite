import { expect, test } from "@playwright/test";
import { loginAsAdmin, resetAndSeedAdmin, seedGame, seedGuest, seedUser } from "./helpers";

let adminId: string;
test.beforeEach(async () => {
  adminId = await resetAndSeedAdmin();
});

const day = (n: number) => new Date(2026, 0, n);

test.describe("leaderboard", () => {
  test("the dashboard shows the leaderboard, ranked by net profit by default", async ({ page }) => {
    const ace = await seedUser({ email: "ace@test.local", name: "Ace" });
    const bea = await seedUser({ email: "bea@test.local", name: "Bea" });
    const cy = await seedUser({ email: "cy@test.local", name: "Cy" });
    await seedGame({
      creatorId: adminId,
      status: "COMPLETED",
      endedAt: day(1),
      seats: [
        { userId: ace, boughtIn: 100, cashedOut: 150 }, // +50, 50% ROI
        { userId: bea, boughtIn: 20, cashedOut: 50 }, // +30, 150% ROI
        { userId: cy, boughtIn: 20, cashedOut: 20 },
      ],
    });
    for (const d of [2, 3]) {
      await seedGame({ creatorId: adminId, status: "COMPLETED", endedAt: day(d), seats: [{ userId: cy, cashedOut: 20 }] });
    }

    await loginAsAdmin(page);
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Ace");
    await expect(rows.nth(0)).toContainText("+$50.00");
    await expect(rows.nth(1)).toContainText("Bea");
    await expect(rows.nth(2)).toContainText("Cy");

    // The standalone page agrees with the dashboard
    await page.goto("/leaderboard");
    await expect(page.locator("tbody tr").first()).toContainText("Ace");
  });

  test("the sort buttons re-rank by ROI, average per session, and sessions played", async ({ page }) => {
    const ace = await seedUser({ email: "ace@test.local", name: "Ace" });
    const bea = await seedUser({ email: "bea@test.local", name: "Bea" });
    const cy = await seedUser({ email: "cy@test.local", name: "Cy" });
    await seedGame({
      creatorId: adminId,
      status: "COMPLETED",
      endedAt: day(1),
      seats: [
        { userId: ace, boughtIn: 100, cashedOut: 150 },
        { userId: bea, boughtIn: 20, cashedOut: 50 },
        { userId: cy, boughtIn: 20, cashedOut: 20 },
      ],
    });
    for (const d of [2, 3]) {
      await seedGame({ creatorId: adminId, status: "COMPLETED", endedAt: day(d), seats: [{ userId: cy, cashedOut: 20 }] });
    }

    await loginAsAdmin(page);
    const first = page.locator("tbody tr").first();
    await expect(first).toContainText("Ace"); // net profit

    await page.getByRole("button", { name: "ROI %" }).click();
    await expect(first).toContainText("Bea");

    await page.getByRole("button", { name: "Avg / session" }).click();
    await expect(first).toContainText("Ace");

    await page.getByRole("button", { name: "Sessions played" }).click();
    await expect(first).toContainText("Cy");

    await page.getByRole("button", { name: "Net profit" }).click();
    await expect(first).toContainText("Ace");
  });

  test("flags hot and cold streaks", async ({ page }) => {
    const hot = await seedUser({ email: "hot@test.local", name: "Hotshot" });
    const cold = await seedUser({ email: "cold@test.local", name: "Frosty" });
    for (const d of [1, 2, 3]) {
      await seedGame({ creatorId: adminId, status: "COMPLETED", endedAt: day(d), seats: [{ userId: hot, cashedOut: 30 }] });
    }
    for (const d of [4, 5]) {
      await seedGame({ creatorId: adminId, status: "COMPLETED", endedAt: day(d), seats: [{ userId: cold, cashedOut: 5 }] });
    }

    await loginAsAdmin(page);
    await expect(page.getByRole("row", { name: /Hotshot/ })).toContainText("🔥 3");
    await expect(page.getByRole("row", { name: /Frosty/ })).toContainText("❄️ 2");
  });

  test("guests are ranked alongside accounts and tagged as guests", async ({ page }) => {
    const gina = await seedGuest(adminId, "Gina");
    await seedGame({ creatorId: adminId, status: "COMPLETED", seats: [{ guestId: gina, cashedOut: 35 }] });

    await loginAsAdmin(page);
    const row = page.getByRole("row", { name: /Gina/ });
    await expect(row).toContainText("(guest)");
    await expect(row).toContainText("+$15.00");
  });

  test("games still in progress don't count", async ({ page }) => {
    const gina = await seedGuest(adminId, "Gina");
    await seedGame({ creatorId: adminId, status: "ACTIVE", seats: [{ guestId: gina }] });
    await loginAsAdmin(page);
    await expect(page.getByText("No completed games yet")).toBeVisible();
  });
});
