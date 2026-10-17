import { expect, test } from "@playwright/test";
import {
  ADMIN,
  loginAsAdmin,
  openSessionAs,
  participantRow,
  resetAndSeedAdmin,
  seedGame,
  seedGuest,
  seedUser,
} from "./helpers";

let adminId: string;
test.beforeEach(async () => {
  adminId = await resetAndSeedAdmin();
});

const PICKER = "Search friends or type a name to add a guest...";

test.describe("empty states", () => {
  test("a fresh install has no games and an empty leaderboard", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByText("No completed games yet")).toBeVisible();
    await page.goto("/games");
    await expect(page.getByText("No active games.")).toBeVisible();
    await expect(page.getByText("No completed games yet.")).toBeVisible();
  });
});

test.describe("chip sets and creating a game", () => {
  test("create a chip set, then a game that shows its chip plan", async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto("/chip-sets/new");
    await page.getByLabel("Name").fill("Home set");
    await page.getByRole("button", { name: "Save chip set" }).click();
    await expect(page).toHaveURL(/\/chip-sets$/);
    await expect(page.getByRole("heading", { name: "Home set" })).toBeVisible();
    await expect(page.getByText("$0.25 × 100")).toBeVisible();

    await page.goto("/games/new");
    await expect(page.getByLabel("Chip set")).toContainText("Home set");
    await page.getByPlaceholder(PICKER).fill("Gus");
    await page.getByRole("button", { name: 'Add "Gus" as a guest' }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Gus (guest)" })).toBeVisible();
    await page.getByRole("button", { name: "Create game" }).click();

    await expect(page).toHaveURL(/\/games\/.+/);
    await expect(page.getByRole("heading", { name: "$20.00 buy-in" })).toBeVisible();
    await expect(page.getByText("Chip plan (per player)")).toBeVisible();
    await expect(page.getByText("$0.25 × 20")).toBeVisible();
    await expect(page.getByText("$5.00 × 1")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Table 1 \(2\/9\)/ })).toBeVisible();
    await expect(participantRow(page, ADMIN.name)).toContainText("Bought in: $20.00");
    await expect(participantRow(page, "Gus")).toContainText("Bought in: $20.00");
  });

  test("the creator is pre-selected in the roster, and can remove themselves to just bank", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/games/new");
    const chip = page.getByRole("listitem").filter({ hasText: ADMIN.name });
    await expect(chip).toBeVisible();

    await page.getByRole("button", { name: `Remove ${ADMIN.name}` }).click();
    await expect(chip).toHaveCount(0);
    await page.getByRole("button", { name: "Create game" }).click();
    await expect(page.getByText("Add at least one player.")).toBeVisible();
  });

  test("a new game shows up under Active on the Games page", async ({ page }) => {
    const gus = await seedGuest(adminId, "Gus");
    await seedGame({ creatorId: adminId, seats: [{ userId: adminId }, { guestId: gus }] });
    await loginAsAdmin(page);
    await page.goto("/games");
    await expect(page.getByRole("link", { name: /\$20\.00 buy-in · 2 players · banked by Admin Andi/ })).toBeVisible();
  });
});

test.describe("running a game night", () => {
  test("rebuy, add a late guest, cash out, close in one go, and see it on the leaderboard", async ({ page }) => {
    const gus = await seedGuest(adminId, "Gus");
    const hal = await seedGuest(adminId, "Hal");
    const { gameId } = await seedGame({
      creatorId: adminId,
      seats: [{ userId: adminId }, { guestId: gus }, { guestId: hal }],
    });
    await loginAsAdmin(page);
    await page.goto(`/games/${gameId}`);

    // Rebuy
    const gusRow = participantRow(page, "Gus");
    await gusRow.getByRole("button", { name: "Rebuy" }).click();
    await gusRow.getByPlaceholder("Amount ($)").fill("10");
    await gusRow.getByRole("button", { name: "Confirm" }).click();
    await expect(gusRow).toContainText("Bought in: $30.00");

    // Someone walks in late
    await page.getByRole("button", { name: "+ Add player" }).click();
    await page.getByPlaceholder(PICKER).fill("Late Larry");
    await page.getByRole("button", { name: 'Add "Late Larry" as a guest' }).click();
    await expect(page.getByText("for:")).toBeVisible();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(participantRow(page, "Late Larry")).toContainText("Bought in: $20.00");

    // Gus leaves early
    await gusRow.getByRole("button", { name: "Cash out" }).click();
    await gusRow.getByPlaceholder("Amount ($)").fill("45");
    await gusRow.getByRole("button", { name: "Confirm" }).click();
    await expect(gusRow).toContainText("Cashed out: $45.00");
    await expect(gusRow).toContainText("+$15.00");
    await expect(gusRow.getByRole("button", { name: "Rebuy" })).toHaveCount(0);

    // Close everyone out from one popout
    await page.getByRole("button", { name: "Close game" }).click();
    const modal = page.locator("div.fixed.inset-0");
    await expect(modal.getByRole("heading", { name: "Close out everyone" })).toBeVisible();
    const amount = (who: string) =>
      modal.locator("label").filter({ hasText: who }).getByPlaceholder("Amount ($)");
    const confirm = modal.getByRole("button", { name: "Confirm & close" });

    await expect(amount("Gus")).toHaveValue("45"); // already cashed out, pre-filled
    await expect(confirm).toBeDisabled(); // others still blank
    await amount(ADMIN.name).fill("20");
    await amount("Hal").fill("0"); // busted with nothing
    await expect(confirm).toBeDisabled(); // Late Larry still blank
    await amount("Late Larry").fill("15");
    await expect(confirm).toBeEnabled();

    // Live reconciliation: bought in 20 + 30 + 20 + 20 = 90, cashed out 20 + 45 + 0 + 15 = 80
    await expect(modal).toContainText("Bought in: $90.00");
    await expect(modal).toContainText("Cashed out: $80.00");
    await expect(modal).toContainText("(-$10.00)");

    await confirm.click();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    await expect(participantRow(page, "Hal")).toContainText("Cashed out: $0.00");
    await expect(participantRow(page, "Hal")).toContainText("-$20.00");
    await expect(participantRow(page, "Late Larry")).toContainText("-$5.00");
    for (const name of ["Close game", "+ Add player", "Rebuy", "Cash out"]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }

    // The results flow into the leaderboard
    await page.goto("/dashboard");
    await expect(page.getByRole("row", { name: /Gus/ })).toContainText("+$15.00");
    await expect(page.getByRole("row", { name: /Hal/ })).toContainText("-$20.00");
  });

  test("the Close game popout can be cancelled without closing", async ({ page }) => {
    const gus = await seedGuest(adminId, "Gus");
    const { gameId } = await seedGame({ creatorId: adminId, seats: [{ guestId: gus }] });
    await loginAsAdmin(page);
    await page.goto(`/games/${gameId}`);

    await page.getByRole("button", { name: "Close game" }).click();
    await page.locator("div.fixed.inset-0").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Close out everyone" })).toHaveCount(0);
    await expect(page.getByText(/In progress/)).toBeVisible();
  });
});

test.describe("other players", () => {
  test("anyone can browse and join an active game, but only the banker gets controls", async ({
    page,
    browser,
    baseURL,
  }) => {
    await seedUser({ email: "pat@test.local", name: "Pat Player" });
    const gus = await seedGuest(adminId, "Gus");
    const { gameId } = await seedGame({ creatorId: adminId, seats: [{ guestId: gus }] });

    const pat = await openSessionAs(browser, baseURL, "pat@test.local");
    await pat.page.getByRole("link", { name: "Games", exact: true }).click();
    await pat.page.getByRole("link", { name: /banked by Admin Andi/ }).click();
    await expect(pat.page.getByRole("heading", { name: "$20.00 buy-in" })).toBeVisible();

    // Read-only for non-bankers
    for (const name of ["Close game", "+ Add player", "Delete game", "Rebuy", "Cash out"]) {
      await expect(pat.page.getByRole("button", { name })).toHaveCount(0);
    }
    await expect(pat.page.getByRole("combobox")).toHaveCount(0);

    // Joining self-seats them with a buy-in that defaults to the game's
    await pat.page.getByRole("button", { name: "Join game" }).click();
    await expect(pat.page.getByRole("spinbutton")).toHaveValue("20");
    await pat.page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(participantRow(pat.page, "Pat Player")).toContainText("Bought in: $20.00");
    await expect(pat.page.getByRole("button", { name: "Join game" })).toHaveCount(0);

    // The banker now sees Pat, with controls
    await loginAsAdmin(page);
    await page.goto(`/games/${gameId}`);
    await expect(participantRow(page, "Pat Player").getByRole("button", { name: "Rebuy" })).toBeVisible();
    await pat.context.close();
  });
});

test.describe("tables (9 players max)", () => {
  const NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet"];

  test("the banker can shuffle players between tables, and a full table refuses more", async ({ page }) => {
    const seats = [];
    for (const [i, name] of NAMES.entries()) {
      seats.push({ guestId: await seedGuest(adminId, name), table: i < 9 ? 1 : 2 });
    }
    const { gameId } = await seedGame({ creatorId: adminId, seats });
    await loginAsAdmin(page);
    await page.goto(`/games/${gameId}`);

    await expect(page.getByRole("heading", { name: "Table 1 (9/9)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Table 2 (1/9)" })).toBeVisible();

    // Table 1 is full, so Juliet can't join it
    await participantRow(page, "Juliet").getByRole("combobox").selectOption("1");
    await expect(participantRow(page, "Juliet")).toContainText("Table 1 is already full (9/9).");
    await expect(page.getByRole("heading", { name: "Table 2 (1/9)" })).toBeVisible();

    // Moving someone out to a brand new table works...
    await participantRow(page, "Alpha").getByRole("combobox").selectOption("3");
    await expect(page.getByRole("heading", { name: "Table 3 (1/9)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Table 1 (8/9)" })).toBeVisible();

    // ...which frees a seat, so Juliet can now move in and Table 2 disappears
    await participantRow(page, "Juliet").getByRole("combobox").selectOption("1");
    await expect(page.getByRole("heading", { name: "Table 1 (9/9)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Table 2/ })).toHaveCount(0);
  });

  test("a seat frees up when someone at a full table cashes out", async ({ page }) => {
    const seats = [];
    for (const name of NAMES.slice(0, 9)) {
      seats.push({ guestId: await seedGuest(adminId, name), table: 1 });
    }
    await seedGuest(adminId, "Late Larry");
    const { gameId } = await seedGame({ creatorId: adminId, seats });
    await loginAsAdmin(page);
    await page.goto(`/games/${gameId}`);
    await expect(page.getByRole("heading", { name: "Table 1 (9/9)" })).toBeVisible();

    const alpha = participantRow(page, "Alpha");
    await alpha.getByRole("button", { name: "Cash out" }).click();
    await alpha.getByPlaceholder("Amount ($)").fill("25");
    await alpha.getByRole("button", { name: "Confirm" }).click();
    await expect(alpha).toContainText("Cashed out: $25.00");
    await expect(page.getByRole("heading", { name: "Table 1 (8/9)" })).toBeVisible();

    // The freed seat takes the next player instead of opening Table 2
    await page.getByRole("button", { name: "+ Add player" }).click();
    await page.getByPlaceholder(PICKER).fill("Late Larry");
    await page.getByRole("button", { name: "Late Larry" }).click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(participantRow(page, "Late Larry")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Table 1 (9/9)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Table 2/ })).toHaveCount(0);
  });

  test("a roster of 10 is split across two tables when the game is created", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/games/new");
    for (const name of NAMES.slice(0, 9)) {
      await page.getByPlaceholder(PICKER).fill(name);
      await page.getByRole("button", { name: `Add "${name}" as a guest` }).click();
      await expect(page.getByRole("listitem").filter({ hasText: `${name} (guest)` })).toBeVisible();
    }
    // Admin + 9 guests = 10 players
    await page.getByRole("button", { name: "Create game" }).click();
    await expect(page.getByRole("heading", { name: "Table 1 (9/9)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Table 2 (1/9)" })).toBeVisible();
  });
});

test.describe("deleting a game", () => {
  test("needs confirmation; cancelling keeps it, confirming removes it and its stats", async ({ page }) => {
    const { gameId } = await seedGame({
      creatorId: adminId,
      status: "COMPLETED",
      seats: [{ userId: adminId, cashedOut: 40 }],
    });
    await loginAsAdmin(page);
    await page.goto(`/games/${gameId}`);

    await page.getByRole("button", { name: "Delete game" }).click();
    await expect(page.getByText(/Permanently delete this game\?/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(/Permanently delete this game\?/)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(gameId));

    await page.getByRole("button", { name: "Delete game" }).click();
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page).toHaveURL(/\/games$/);
    await expect(page.getByText("No completed games yet.")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText("No completed games yet")).toBeVisible();
  });

  test("an admin can delete anyone's game, but other players can't", async ({ page, browser, baseURL }) => {
    const pat = await seedUser({ email: "pat@test.local", name: "Pat Player" });
    await seedUser({ email: "lee@test.local", name: "Lee Other" });
    const { gameId } = await seedGame({
      creatorId: pat,
      status: "COMPLETED",
      seats: [{ userId: pat, cashedOut: 20 }],
    });

    await loginAsAdmin(page);
    await page.goto(`/games/${gameId}`);
    await expect(page.getByRole("button", { name: "Delete game" })).toBeVisible();

    const lee = await openSessionAs(browser, baseURL, "lee@test.local");
    await lee.page.goto(`/games/${gameId}`);
    await expect(lee.page.getByRole("heading", { name: "$20.00 buy-in" })).toBeVisible();
    await expect(lee.page.getByRole("button", { name: "Delete game" })).toHaveCount(0);
    await lee.context.close();
  });
});
