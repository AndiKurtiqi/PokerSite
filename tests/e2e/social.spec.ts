import { expect, test } from "@playwright/test";
import {
  loginAsAdmin,
  resetAndSeedAdmin,
  seedFriendship,
  seedGame,
  seedGuest,
  seedUser,
} from "./helpers";

let adminId: string;
test.beforeEach(async () => {
  adminId = await resetAndSeedAdmin();
});

test.describe("friends page", () => {
  test("lists everyone you haven't friended as suggestions, no typing needed", async ({ page }) => {
    await seedUser({ email: "bob@test.local", name: "Bob Builder" });
    await seedUser({ email: "cat@test.local", name: "Cat Carter" });
    await seedUser({ email: "pending@test.local", name: "Nope Pending", status: "PENDING" });
    await loginAsAdmin(page);
    await page.goto("/friends");

    const rows = page.getByTestId("suggestion-row");
    await expect(rows).toHaveCount(2); // approved non-friends only: not you, not pending accounts
    await expect(rows.nth(0)).toContainText("Bob Builder");
    await expect(rows.nth(1)).toContainText("Cat Carter");
  });

  test("people you've played with are suggested first, with the reason", async ({ page }) => {
    const bob = await seedUser({ email: "bob@test.local", name: "Bob Builder" });
    await seedUser({ email: "aaron@test.local", name: "Aaron Early" });
    await seedGame({ creatorId: adminId, status: "COMPLETED", seats: [{ userId: adminId, cashedOut: 20 }, { userId: bob, cashedOut: 20 }] });
    await loginAsAdmin(page);
    await page.goto("/friends");

    const rows = page.getByTestId("suggestion-row");
    await expect(rows.nth(0)).toContainText("Bob Builder");
    await expect(rows.nth(0)).toContainText("Played 1 game with you");
    await expect(rows.nth(1)).toContainText("Aaron Early");
  });

  test("adding a suggestion moves them to friends and the list refills until nobody is left", async ({ page }) => {
    for (let i = 1; i <= 7; i++) {
      await seedUser({ email: `p${i}@test.local`, name: `Player ${i}` });
    }
    await loginAsAdmin(page);
    await page.goto("/friends");

    const rows = page.getByTestId("suggestion-row");
    await expect(rows).toHaveCount(5); // a batch of 5 of the 7
    await expect(page.getByText("2 more after these")).toBeVisible();

    await rows.first().getByRole("button", { name: "+ Add friend" }).click();
    const friends = page.getByTestId("friend-row");
    await expect(friends).toHaveCount(1);
    await expect(friends.first()).toContainText("Player 1");
    await expect(rows).toHaveCount(5); // refilled from the remaining 6

    for (let i = 0; i < 6; i++) {
      await rows.first().getByRole("button", { name: "+ Add friend" }).click();
      await expect(friends).toHaveCount(i + 2);
    }
    await expect(rows).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Suggested friends" })).toHaveCount(0);
  });

  test("add a friend by searching, and they can't be added twice", async ({ page }) => {
    await seedUser({ email: "bob@test.local", name: "Bob Builder" });
    await loginAsAdmin(page);
    await page.goto("/friends");
    await expect(page.getByText("No friends yet.")).toBeVisible();

    const search = page.getByPlaceholder("Search players to add as a friend...");
    await search.fill("bob");
    await page.locator("div.absolute").getByRole("button", { name: "+ Add friend" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Bob Builder" })).toContainText("No sessions yet");

    // Already a friend, so no longer offered as a search result
    await search.fill("bob");
    await expect(page.getByText("No matching players.")).toBeVisible();
  });

  test("the friend is mutual: they see you as a friend too", async ({ page, browser, baseURL }) => {
    await seedUser({ email: "bob@test.local", name: "Bob Builder" });
    await loginAsAdmin(page);
    await page.goto("/friends");
    await page.getByPlaceholder("Search players to add as a friend...").fill("bob");
    await page.locator("div.absolute").getByRole("button", { name: "+ Add friend" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Bob Builder" })).toBeVisible();

    const ctx = await browser.newContext({ baseURL });
    const bob = await ctx.newPage();
    await bob.goto("/login");
    await bob.getByLabel("Email").fill("bob@test.local");
    await bob.getByLabel("Password").fill("PlayerPass123");
    await bob.getByRole("button", { name: "Log in" }).click();
    await bob.waitForURL("**/dashboard");
    await bob.goto("/friends");
    await expect(bob.getByRole("listitem").filter({ hasText: "Admin Andi" })).toBeVisible();
    await ctx.close();
  });

  test("shows each friend's session count and net result", async ({ page }) => {
    const bob = await seedUser({ email: "bob@test.local", name: "Bob Builder" });
    await seedFriendship(adminId, bob);
    await seedGame({ creatorId: adminId, status: "COMPLETED", seats: [{ userId: bob, cashedOut: 50 }] }); // +30
    await seedGame({ creatorId: adminId, status: "COMPLETED", seats: [{ userId: bob, cashedOut: 15 }] }); // -5

    await loginAsAdmin(page);
    await page.goto("/friends");
    await expect(page.getByRole("listitem").filter({ hasText: "Bob Builder" })).toContainText("2 sessions · +$25.00");
  });
});

test.describe("player picker type-ahead", () => {
  test("lists friends, then your guests, then other players (with add-as-friend), then offers a new guest", async ({
    page,
  }) => {
    const friend = await seedUser({ email: "af@test.local", name: "Alice Friend" });
    await seedUser({ email: "ao@test.local", name: "Alice Other" });
    await seedGuest(adminId, "Alice Guest");
    await seedFriendship(adminId, friend);

    await loginAsAdmin(page);
    await page.goto("/games/new");
    await page.getByPlaceholder("Search friends or type a name to add a guest...").fill("alice");

    const dropdown = page.locator(".absolute.z-10");
    await expect(dropdown).toContainText("Alice Friend");
    const text = (await dropdown.textContent()) ?? "";
    expect(text.indexOf("Friends")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("Friends")).toBeLessThan(text.indexOf("Your guests"));
    expect(text.indexOf("Your guests")).toBeLessThan(text.indexOf("Other players"));
    expect(text).toContain('Add "alice" as a guest');

    // Adding a non-friend as a friend also puts them in the roster
    await dropdown.getByRole("button", { name: "+ Add as friend" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Alice Other" })).toBeVisible();

    await page.goto("/friends");
    await expect(page.getByRole("listitem").filter({ hasText: "Alice Other" })).toBeVisible();
  });

  test("a guest created once is offered again next time", async ({ page }) => {
    await seedGuest(adminId, "Remembered Rita");
    await loginAsAdmin(page);
    await page.goto("/games/new");
    await page.getByPlaceholder("Search friends or type a name to add a guest...").fill("rita");

    const dropdown = page.locator(".absolute.z-10");
    await expect(dropdown).toContainText("Your guests");
    await dropdown.getByRole("button", { name: "Remembered Rita" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Remembered Rita (guest)" })).toBeVisible();
  });
});
