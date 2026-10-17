/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from "bcryptjs";
import { vi, type Mock } from "vitest";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Guest, User } from "@/generated/prisma/client";

/** Loosely-typed JSON body from a route handler response. */
export type Json = any;

let counter = 0;

export const DEFAULT_PASSWORD = "Password123";

export async function createUser(
  overrides: Partial<{
    email: string;
    displayName: string;
    password: string;
    role: "ADMIN" | "PLAYER";
    status: "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";
    avatarUrl: string | null;
  }> = {}
): Promise<User> {
  counter++;
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user${counter}@test.local`,
      displayName: overrides.displayName ?? `User ${counter}`,
      // Low bcrypt cost keeps the suite fast; hashes still verify normally.
      passwordHash: bcrypt.hashSync(overrides.password ?? DEFAULT_PASSWORD, 4),
      role: overrides.role ?? "PLAYER",
      status: overrides.status ?? "APPROVED",
      avatarUrl: overrides.avatarUrl ?? null,
    },
  });
}

export const createAdmin = (overrides: Parameters<typeof createUser>[0] = {}) =>
  createUser({ role: "ADMIN", displayName: "Admin", ...overrides });

export async function createGuest(createdBy: User, name?: string): Promise<Guest> {
  counter++;
  return prisma.guest.create({
    data: { name: name ?? `Guest ${counter}`, createdById: createdBy.id },
  });
}

export async function createGuests(createdBy: User, count: number): Promise<Guest[]> {
  const guests: Guest[] = [];
  for (let i = 0; i < count; i++) guests.push(await createGuest(createdBy));
  return guests;
}

/** Makes two users friends of each other (the app stores both directions). */
export async function befriend(a: User, b: User): Promise<void> {
  await prisma.friendship.createMany({
    data: [
      { ownerId: a.id, friendId: b.id },
      { ownerId: b.id, friendId: a.id },
    ],
  });
}

export async function createChipSet(
  owner: User,
  denominations: { value: number; quantity: number }[] = [
    { value: 0.25, quantity: 100 },
    { value: 0.5, quantity: 100 },
    { value: 1, quantity: 50 },
    { value: 5, quantity: 25 },
  ],
  name = "Standard set"
) {
  return prisma.chipSet.create({
    data: { ownerId: owner.id, name, denominations: { create: denominations } },
    include: { denominations: true },
  });
}

export type Seat = {
  user?: User;
  guest?: Guest;
  table?: number;
  boughtIn?: number;
  cashedOut?: number | null;
};

/** Builds a game directly in the database (arrange step, bypasses the API). */
export async function createGame(opts: {
  creator: User;
  seats?: Seat[];
  buyIn?: number;
  status?: "ACTIVE" | "COMPLETED";
  endedAt?: Date;
  chipSetId?: string;
}) {
  const buyIn = opts.buyIn ?? 20;
  const status = opts.status ?? "ACTIVE";
  const game = await prisma.game.create({
    data: {
      creatorId: opts.creator.id,
      buyInAmount: buyIn,
      status,
      endedAt: status === "COMPLETED" ? (opts.endedAt ?? new Date()) : null,
      chipSetId: opts.chipSetId ?? null,
    },
  });

  const participants = [];
  for (const seat of opts.seats ?? []) {
    const boughtIn = seat.boughtIn ?? buyIn;
    const cashedOut = seat.cashedOut ?? null;
    participants.push(
      await prisma.gameParticipant.create({
        data: {
          gameId: game.id,
          userId: seat.user?.id ?? null,
          guestId: seat.guest?.id ?? null,
          tableNumber: seat.table ?? 1,
          totalBoughtIn: boughtIn,
          totalCashedOut: cashedOut,
          leftAt: cashedOut !== null ? new Date() : null,
          transactions: {
            create: [
              { type: "BUY_IN" as const, amount: boughtIn },
              ...(cashedOut !== null ? [{ type: "CASH_OUT" as const, amount: cashedOut }] : []),
            ],
          },
        },
      })
    );
  }

  return { game, participants };
}

/** Controls who route handlers see as the logged-in user. Pass null for "logged out". */
export function signInAs(user: User | null): void {
  const mocked = vi.mocked(auth) as unknown as Mock;
  mocked.mockResolvedValue(
    user
      ? {
          user: {
            id: user.id,
            email: user.email,
            name: user.displayName,
            role: user.role,
            status: user.status,
          },
          expires: new Date(Date.now() + 86_400_000).toISOString(),
        }
      : null
  );
}

export function jsonRequest(method: string, body?: unknown, url = "http://localhost/api/test") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Wraps route params the way Next.js passes them to handlers. */
export const ctx = <T extends Record<string, string>>(params: T) => ({
  params: Promise.resolve(params),
});

/** Reads a handler's Response into { status, body }. */
export async function read(res: Response): Promise<{ status: number; body: Json }> {
  return { status: res.status, body: await res.json() };
}

export const num = (value: unknown) => Number(value);
