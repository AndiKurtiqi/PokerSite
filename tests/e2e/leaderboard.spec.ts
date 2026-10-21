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

  test("the Rank card on the dashboard matches the player's row in the table", async ({ page }) => {
    // Seeded so the admin is NOT first in the order the players were created.
    const first = await seedUser({ email: "z@test.local", name: "Zoe Zed" });
    const second = await seedUser({ email: "y@test.local", name: "Yan Yo" });
    await seedGame({
      creatorId: adminId,
      status: "COMPLETED",
      endedAt: day(1),
      seats: [
        { userId: first, boughtIn: 20, cashedOut: 10 }, // -10
        { userId: second, boughtIn: 20, cashedOut: 80 }, // +60
        { userId: adminId, boughtIn: 20, cashedOut: 40 }, // +20
      ],
    });

    await loginAsAdmin(page);
    await expect(page.getByTestId("rank-card")).toContainText("#2 of 3");
    await expect(page.locator("tbody tr").nth(1)).toContainText("Admin Andi");
  });

  test("players who are level share a rank", async ({ page }) => {
    const a = await seedUser({ email: "a@test.local", name: "Ann" });
    const b = await seedUser({ email: "b@test.local", name: "Ben" });
    await seedGame({
      creatorId: adminId,
      status: "COMPLETED",
      endedAt: day(1),
      seats: [
        { userId: adminId, boughtIn: 20, cashedOut: 60 }, // +40
        { userId: a, boughtIn: 20, cashedOut: 20 },
        { userId: b, boughtIn: 20, cashedOut: 20 },
      ],
    });

    await loginAsAdmin(page);
    const ranks = page.locator("tbody tr td:first-child");
    await expect(ranks).toHaveText(["1", "2", "2"]);
    await expect(page.getByTestId("rank-card")).toContainText("#1 of 3");
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

    const pills = page.getByTestId("sort-pills");
    await pills.getByRole("button", { name: "ROI %" }).click();
    await expect(first).toContainText("Bea");

    await pills.getByRole("button", { name: "Avg / session" }).click();
    await expect(first).toContainText("Ace");

    await pills.getByRole("button", { name: "Sessions played" }).click();
    await expect(first).toContainText("Cy");

    await pills.getByRole("button", { name: "Net profit" }).click();
    await expect(first).toContainText("Ace");
  });

  test("clicking a column sorts best-first, again flips it, and # resets to the default ranking", async ({ page }) => {
    const ace = await seedUser({ email: "ace@test.local", name: "Ace" });
    const bea = await seedUser({ email: "bea@test.local", name: "Bea" });
    const cy = await seedUser({ email: "cy@test.local", name: "Cy" });
    // Sessions: Cy 3, Bea 2, Ace 1. Net profit: Ace +50, Bea +30, Cy 0.
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
    await seedGame({ creatorId: adminId, status: "COMPLETED", endedAt: day(2), seats: [{ userId: bea, boughtIn: 20, cashedOut: 20 }, { userId: cy, boughtIn: 20, cashedOut: 20 }] });
    await seedGame({ creatorId: adminId, status: "COMPLETED", endedAt: day(3), seats: [{ userId: cy, boughtIn: 20, cashedOut: 20 }] });

    await loginAsAdmin(page);
    const names = page.locator("tbody tr td:nth-child(2)");
    const sessionsHeader = page.getByRole("columnheader", { name: /Sessions/ });
    await expect(names).toHaveText(["Ace", "Bea", "Cy"]); // default: net profit, best first

    // Once: most sessions first
    await sessionsHeader.getByRole("button").click();
    await expect(names).toHaveText(["Cy", "Bea", "Ace"]);
    await expect(sessionsHeader).toHaveAttribute("aria-sort", "descending");

    // Twice: fewest sessions first (ranks count down: Ace is last by sessions)
    await sessionsHeader.getByRole("button").click();
    await expect(names).toHaveText(["Ace", "Bea", "Cy"]);
    await expect(sessionsHeader).toHaveAttribute("aria-sort", "ascending");
    await expect(page.locator("tbody tr td:first-child")).toHaveText(["3", "2", "1"]);

    // Three times: back to most first
    await sessionsHeader.getByRole("button").click();
    await expect(names).toHaveText(["Cy", "Bea", "Ace"]);

    // The sort buttons above the table act the same way
    const pills = page.getByTestId("sort-pills");
    await pills.getByRole("button", { name: "Sessions played" }).click(); // already active: flips
    await expect(names).toHaveText(["Ace", "Bea", "Cy"]);

    // A different column starts best-first again
    await page.getByRole("columnheader", { name: /Net profit/ }).getByRole("button").click();
    await expect(names).toHaveText(["Ace", "Bea", "Cy"]);
    await page.getByRole("columnheader", { name: /Net profit/ }).getByRole("button").click();
    await expect(names).toHaveText(["Cy", "Bea", "Ace"]);

    // Clicking # puts everything back to the default
    await page.getByRole("button", { name: "Reset to the default ranking" }).click();
    await expect(names).toHaveText(["Ace", "Bea", "Cy"]);
    await expect(page.getByRole("columnheader", { name: /Net profit/ })).toHaveAttribute("aria-sort", "descending");
    await expect(page.locator("tbody tr td:first-child")).toHaveText(["1", "2", "3"]);
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
