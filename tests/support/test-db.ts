import { execSync } from "node:child_process";
import pg from "pg";

// A dedicated throwaway database on the local Docker Postgres. Tests wipe it
// constantly, so it must never be the dev or production database.
export const TEST_DB_NAME = "poker_home_games_test";
export const TEST_DATABASE_URL = `postgresql://poker:poker@localhost:5433/${TEST_DB_NAME}`;
const MAINTENANCE_DATABASE_URL = "postgresql://poker:poker@localhost:5433/postgres";

export const ALL_TABLES = [
  "Transaction",
  "GameParticipant",
  "Game",
  "ChipDenomination",
  "ChipSet",
  "Friendship",
  "Guest",
  "User",
] as const;

export const TRUNCATE_SQL = `TRUNCATE TABLE ${ALL_TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`;

/** Throws unless the URL points at a local database whose name ends in "_test". */
export function assertSafeTestDatabase(url: string | undefined): void {
  if (!url) throw new Error("DATABASE_URL is not set for the test run.");
  const parsed = new URL(url);
  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  const dbName = parsed.pathname.replace(/^\//, "");
  if (!isLocal || !dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests against "${parsed.hostname}/${dbName}". ` +
        `Tests only run against a local database whose name ends in "_test".`
    );
  }
}

/** Creates the test database if needed and applies all Prisma migrations to it. */
export async function ensureTestDatabase(): Promise<void> {
  assertSafeTestDatabase(TEST_DATABASE_URL);

  const client = new pg.Client({ connectionString: MAINTENANCE_DATABASE_URL });
  try {
    await client.connect();
  } catch {
    throw new Error(
      "Can't reach local Postgres on localhost:5433. Start it with `docker compose up -d` and re-run the tests."
    );
  }

  try {
    const { rows } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      TEST_DB_NAME,
    ]);
    if (rows.length === 0) await client.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  } finally {
    await client.end();
  }

  try {
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: "pipe",
    });
  } catch (err) {
    const output = err instanceof Error && "stderr" in err ? String(err.stderr) : String(err);
    throw new Error(`Failed to migrate the test database:\n${output}`);
  }
}

/** Wipes every table using a raw pg connection (used by the browser tests). */
export async function truncateAllTables(): Promise<void> {
  assertSafeTestDatabase(TEST_DATABASE_URL);
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(TRUNCATE_SQL);
  } finally {
    await client.end();
  }
}
