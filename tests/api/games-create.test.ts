import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/games/route";
import { prisma } from "@/lib/prisma";
import {
  createChipSet,
  createGuest,
  createGuests,
  createUser,
  jsonRequest,
  num,
  read,
  signInAs,
} from "../support/factories";

const create = (body: unknown) => POST(jsonRequest("POST", body));

describe("POST /api/games", () => {
  it("creates an active game banked by the caller, with a BUY_IN for every player", async () => {
    const me = await createUser();
    const [g1, g2] = await createGuests(me, 2);
    signInAs(me);

    const { status, body } = await read(
      await create({
        buyInAmount: 20,
        players: [
          { type: "user", id: me.id },
          { type: "guest", id: g1.id },
          { type: "guest", id: g2.id },
        ],
      })
    );
    expect(status).toBe(200);

    const game = await prisma.game.findUniqueOrThrow({
      where: { id: body.game.id },
      include: { participants: { include: { transactions: true } } },
    });
    expect(game.creatorId).toBe(me.id);
    expect(game.status).toBe("ACTIVE");
    expect(num(game.buyInAmount)).toBe(20);
    expect(game.participants).toHaveLength(3);
    for (const p of game.participants) {
      expect(num(p.totalBoughtIn)).toBe(20);
      expect(p.totalCashedOut).toBeNull();
      expect(p.transactions.map((t) => [t.type, num(t.amount)])).toEqual([["BUY_IN", 20]]);
    }
  });

  it("computes and stores a chip plan when a chip set is chosen", async () => {
    const me = await createUser();
    const chipSet = await createChipSet(me);
    const guests = await createGuests(me, 2);
    signInAs(me);

    const { body } = await read(
      await create({
        buyInAmount: 20,
        chipSetId: chipSet.id,
        players: guests.map((g) => ({ type: "guest", id: g.id })),
      })
    );
    const game = await prisma.game.findUniqueOrThrow({ where: { id: body.game.id } });
    const plan = game.chipPlan as unknown as {
      perPlayer: { valueCents: number; countPerPlayer: number }[];
      warnings: string[];
    };
    const total = plan.perPlayer.reduce((s, l) => s + l.valueCents * l.countPerPlayer, 0);
    expect(total).toBe(2000);
    expect(plan.warnings).toEqual([]);
  });

  it("warns in the plan when the chip set doesn't have enough chips for the table", async () => {
    const me = await createUser();
    const chipSet = await createChipSet(me, [
      { value: 0.25, quantity: 5 },
      { value: 1, quantity: 5 },
    ]);
    const guests = await createGuests(me, 3);
    signInAs(me);

    const { body } = await read(
      await create({
        buyInAmount: 20,
        chipSetId: chipSet.id,
        players: guests.map((g) => ({ type: "guest", id: g.id })),
      })
    );
    const game = await prisma.game.findUniqueOrThrow({ where: { id: body.game.id } });
    expect((game.chipPlan as unknown as { warnings: string[] }).warnings.length).toBeGreaterThan(0);
  });

  it("has no chip plan when no chip set is chosen", async () => {
    const me = await createUser();
    const [g] = await createGuests(me, 1);
    signInAs(me);

    const { body } = await read(await create({ buyInAmount: 20, players: [{ type: "guest", id: g.id }] }));
    const game = await prisma.game.findUniqueOrThrow({ where: { id: body.game.id } });
    expect(game.chipPlan).toBeNull();
  });

  it("doesn't use (or link to) a chip set owned by someone else", async () => {
    const me = await createUser();
    const other = await createUser();
    const theirs = await createChipSet(other);
    const [g] = await createGuests(me, 1);
    signInAs(me);

    const { body } = await read(
      await create({ buyInAmount: 20, chipSetId: theirs.id, players: [{ type: "guest", id: g.id }] })
    );
    const game = await prisma.game.findUniqueOrThrow({ where: { id: body.game.id } });
    expect(game.chipPlan).toBeNull();
    expect(game.chipSetId).toBeNull();
  });

  it.each([
    [10, [9, 1]],
    [9, [9]],
    [19, [9, 9, 1]],
  ])("seats %i players across tables of at most 9 -> %j", async (count, expected) => {
    const me = await createUser();
    const guests = await createGuests(me, count);
    signInAs(me);

    const { body } = await read(
      await create({ buyInAmount: 20, players: guests.map((g) => ({ type: "guest", id: g.id })) })
    );
    const participants = await prisma.gameParticipant.findMany({ where: { gameId: body.game.id } });
    const perTable = new Map<number, number>();
    for (const p of participants) perTable.set(p.tableNumber, (perTable.get(p.tableNumber) ?? 0) + 1);
    expect([...perTable.keys()].sort()).toEqual(expected.map((_, i) => i + 1));
    expect([...perTable.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n)).toEqual(expected);
  });

  it("lets a banker seat a guest another banker created (shared guest pool)", async () => {
    const me = await createUser();
    const other = await createUser();
    const theirGuest = await createGuest(other);
    signInAs(me);

    const { status } = await read(
      await create({ buyInAmount: 20, players: [{ type: "guest", id: theirGuest.id }] })
    );
    expect(status).toBe(200);
    expect(await prisma.gameParticipant.count({ where: { guestId: theirGuest.id } })).toBe(1);
  });

  it("rejects a guest that has been merged away", async () => {
    const me = await createUser();
    const target = await createUser();
    const merged = await createGuest(me);
    await prisma.guest.update({ where: { id: merged.id }, data: { mergedIntoId: target.id } });
    signInAs(me);

    const { status, body } = await read(
      await create({ buyInAmount: 20, players: [{ type: "guest", id: merged.id }] })
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid/i);
    expect(await prisma.game.count()).toBe(0);
  });

  it("rejects a user who isn't approved", async () => {
    const me = await createUser();
    const pending = await createUser({ status: "PENDING" });
    signInAs(me);

    expect((await create({ buyInAmount: 20, players: [{ type: "user", id: pending.id }] })).status).toBe(400);
    expect(await prisma.game.count()).toBe(0);
  });

  it("rejects a player that doesn't exist", async () => {
    const me = await createUser();
    signInAs(me);
    expect((await create({ buyInAmount: 20, players: [{ type: "guest", id: "ghost" }] })).status).toBe(400);
  });

  it.each([
    ["no players", { buyInAmount: 20, players: [] }],
    ["a zero buy-in", { buyInAmount: 0, players: [{ type: "user", id: "x" }] }],
    ["a negative buy-in", { buyInAmount: -5, players: [{ type: "user", id: "x" }] }],
    ["a missing buy-in", { players: [{ type: "user", id: "x" }] }],
  ])("rejects %s", async (_label, payload) => {
    const me = await createUser();
    signInAs(me);
    expect((await create(payload)).status).toBe(400);
    expect(await prisma.game.count()).toBe(0);
  });

  it("requires login", async () => {
    signInAs(null);
    expect((await create({ buyInAmount: 20, players: [{ type: "user", id: "x" }] })).status).toBe(401);
  });
});
