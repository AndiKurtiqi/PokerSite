import { afterAll, beforeEach, vi } from "vitest";

// Route handlers call auth() to find the logged-in user. Tests control that
// via signInAs() in factories.ts, so replace the real NextAuth module.
vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertSafeTestDatabase, TRUNCATE_SQL } from "./test-db";

assertSafeTestDatabase(process.env.DATABASE_URL);

beforeEach(async () => {
  vi.mocked(auth).mockReset();
  await prisma.$executeRawUnsafe(TRUNCATE_SQL);
});

afterAll(async () => {
  await prisma.$disconnect();
});
