import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";
import type { Browser, Locator, Page } from "@playwright/test";
import { TEST_DATABASE_URL, TRUNCATE_SQL, assertSafeTestDatabase } from "../support/test-db";

export const ADMIN = { email: "admin@test.local", password: "AdminPass123", name: "Admin Andi" };
export const PASSWORD = "PlayerPass123";

type Role = "ADMIN" | "PLAYER";
type UserStatus = "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";

async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  assertSafeTestDatabase(TEST_DATABASE_URL);
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Wipes the test database and re-creates the admin account. Call in beforeEach. */
export async function resetAndSeedAdmin(): Promise<string> {
  await withDb((c) => c.query(TRUNCATE_SQL));
  return seedUser({ email: ADMIN.email, name: ADMIN.name, password: ADMIN.password, role: "ADMIN" });
}

export async function seedUser(opts: {
  email: string;
  name: string;
  password?: string;
  role?: Role;
  status?: UserStatus;
}): Promise<string> {
  const id = randomUUID();
  await withDb((c) =>
    c.query(
      `INSERT INTO "User" (id, email, "passwordHash", "displayName", role, status)
       VALUES ($1, $2, $3, $4, $5::"Role", $6::"UserStatus")`,
      [
        id,
        opts.email,
        bcrypt.hashSync(opts.password ?? PASSWORD, 4),
        opts.name,
        opts.role ?? "PLAYER",
        opts.status ?? "APPROVED",
      ]
    )
  );
  return id;
}

export async function seedGuest(createdById: string, name: string): Promise<string> {
  const id = randomUUID();
  await withDb((c) =>
    c.query(`INSERT INTO "Guest" (id, name, "createdById") VALUES ($1, $2, $3)`, [id, name, createdById])
  );
  return id;
}

export async function seedFriendship(a: string, b: string): Promise<void> {
  await withDb(async (c) => {
    for (const [owner, friend] of [[a, b], [b, a]]) {
      await c.query(`INSERT INTO "Friendship" (id, "ownerId", "friendId") VALUES ($1, $2, $3)`, [
        randomUUID(),
        owner,
        friend,
      ]);
    }
  });
}

export type SeedSeat = {
  userId?: string;
  guestId?: string;
  table?: number;
  boughtIn?: number;
  cashedOut?: number | null;
};

/** Inserts a game with its participants and transactions directly (arrange step). */
export async function seedGame(opts: {
  creatorId: string;
  seats: SeedSeat[];
  buyIn?: number;
  status?: "ACTIVE" | "COMPLETED";
  endedAt?: Date;
}): Promise<{ gameId: string; participantIds: string[] }> {
  const buyIn = opts.buyIn ?? 20;
  const status = opts.status ?? "ACTIVE";
  const gameId = randomUUID();
  const participantIds: string[] = [];

  await withDb(async (c) => {
    await c.query(
      `INSERT INTO "Game" (id, "creatorId", "buyInAmount", status, "endedAt")
       VALUES ($1, $2, $3, $4::"GameStatus", $5)`,
      [gameId, opts.creatorId, buyIn, status, status === "COMPLETED" ? (opts.endedAt ?? new Date()) : null]
    );

    for (const seat of opts.seats) {
      const id = randomUUID();
      participantIds.push(id);
      const boughtIn = seat.boughtIn ?? buyIn;
      const cashedOut = seat.cashedOut ?? null;
      await c.query(
        `INSERT INTO "GameParticipant"
           (id, "gameId", "userId", "guestId", "tableNumber", "totalBoughtIn", "totalCashedOut", "leftAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          gameId,
          seat.userId ?? null,
          seat.guestId ?? null,
          seat.table ?? 1,
          boughtIn,
          cashedOut,
          cashedOut !== null ? new Date() : null,
        ]
      );
      await c.query(
        `INSERT INTO "Transaction" (id, "participantId", type, amount) VALUES ($1, $2, 'BUY_IN', $3)`,
        [randomUUID(), id, boughtIn]
      );
      if (cashedOut !== null) {
        await c.query(
          `INSERT INTO "Transaction" (id, "participantId", type, amount) VALUES ($1, $2, 'CASH_OUT', $3)`,
          [randomUUID(), id, cashedOut]
        );
      }
    }
  });

  return { gameId, participantIds };
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

/** Logs in and waits until the dashboard has loaded. */
export async function loginToDashboard(page: Page, email: string, password: string = PASSWORD): Promise<void> {
  await login(page, email, password);
  await page.waitForURL("**/dashboard");
}

export const loginAsAdmin = (page: Page) => loginToDashboard(page, ADMIN.email, ADMIN.password);

/**
 * Clicks Log out and waits until sign-out has finished (so the session cookie is gone).
 *
 * Wait for the page's background prefetches to settle first: the auth middleware
 * re-issues the session cookie on every request, so a prefetch that completes just
 * after sign-out would put the cookie back (a small known race in the app).
 */
export async function logout(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("**/login");
}

/** Opens a second, independent browser session logged in as another user. */
export async function openSessionAs(
  browser: Browser,
  baseURL: string | undefined,
  email: string,
  password: string = PASSWORD
) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await loginToDashboard(page, email, password);
  return { context, page };
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A participant row on the game page, found by the player's name. A row's text
 * always starts with the name (sibling elements are joined without spaces, so
 * match the start rather than a word boundary).
 */
export const participantRow = (page: Page, name: string): Locator =>
  page.getByTestId("participant-row").filter({ hasText: new RegExp(`^${escapeRegExp(name)}`) });
