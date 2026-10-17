import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/games/[id]/close/route";
import { prisma } from "@/lib/prisma";
import { createGame, createGuests, createUser, ctx, jsonRequest, num, read, signInAs } from "../support/factories";

const close = (gameId: string, body: unknown) => POST(jsonRequest("POST", body), ctx({ id: gameId }));

/** Banker + a game with two $20 players. */
async function setup() {
  const banker = await createUser();
  const [a, b] = await createGuests(banker, 2);
  const { game, participants } = await createGame({ creator: banker, seats: [{ guest: a }, { guest: b }] });
  return { banker, game, a: participants[0], b: participants[1] };
}

describe("POST /api/games/[id]/close (batch cash-out + close)", () => {
  it("records everyone's cash-out and completes the game", async () => {
    const { banker, game, a, b } = await setup();
    signInAs(banker);

    const { status } = await read(
      await close(game.id, {
        cashouts: [
          { participantId: a.id, amount: 30 },
          { participantId: b.id, amount: 10 },
        ],
      })
    );
    expect(status).toBe(200);

    const saved = await prisma.game.findUniqueOrThrow({
      where: { id: game.id },
      include: { participants: true },
    });
    expect(saved.status).toBe("COMPLETED");
    expect(saved.endedAt).not.toBeNull();
    const byId = new Map(saved.participants.map((p) => [p.id, num(p.totalCashedOut)]));
    expect(byId.get(a.id)).toBe(30);
    expect(byId.get(b.id)).toBe(10);
  });

  it("reports a balanced reconciliation when cash-outs equal buy-ins", async () => {
    const { banker, game, a, b } = await setup();
    signInAs(banker);

    const { body } = await read(
      await close(game.id, {
        cashouts: [
          { participantId: a.id, amount: 25 },
          { participantId: b.id, amount: 15 },
        ],
      })
    );
    expect(body.reconciliation).toEqual({ totalBoughtIn: 40, totalCashedOut: 40, diff: 0, balanced: true });
  });

  it("reports the discrepancy when the chips don't add up", async () => {
    const { banker, game, a, b } = await setup();
    signInAs(banker);

    const { body } = await read(
      await close(game.id, {
        cashouts: [
          { participantId: a.id, amount: 30 },
          { participantId: b.id, amount: 15 },
        ],
      })
    );
    expect(body.reconciliation.diff).toBe(5);
    expect(body.reconciliation.balanced).toBe(false);
  });

  it("accepts a $0 cash-out", async () => {
    const { banker, game, a, b } = await setup();
    signInAs(banker);

    const { status } = await read(
      await close(game.id, {
        cashouts: [
          { participantId: a.id, amount: 40 },
          { participantId: b.id, amount: 0 },
        ],
      })
    );
    expect(status).toBe(200);
    const saved = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: b.id } });
    expect(num(saved.totalCashedOut)).toBe(0);
  });

  it("only writes a new CASH_OUT transaction when the amount actually changed", async () => {
    const banker = await createUser();
    const [a, b] = await createGuests(banker, 2);
    const { game, participants } = await createGame({
      creator: banker,
      seats: [
        { guest: a, cashedOut: 25 }, // already cashed out earlier
        { guest: b },
      ],
    });
    signInAs(banker);

    await close(game.id, {
      cashouts: [
        { participantId: participants[0].id, amount: 25 }, // unchanged
        { participantId: participants[1].id, amount: 15 },
      ],
    });

    const cashOutsFor = (id: string) =>
      prisma.transaction.count({ where: { participantId: id, type: "CASH_OUT" } });
    expect(await cashOutsFor(participants[0].id)).toBe(1);
    expect(await cashOutsFor(participants[1].id)).toBe(1);
  });

  it("lets the banker correct an earlier cash-out while closing", async () => {
    const banker = await createUser();
    const [a] = await createGuests(banker, 1);
    const { game, participants } = await createGame({ creator: banker, seats: [{ guest: a, cashedOut: 25 }] });
    signInAs(banker);

    await close(game.id, { cashouts: [{ participantId: participants[0].id, amount: 30 }] });
    const saved = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: participants[0].id } });
    expect(num(saved.totalCashedOut)).toBe(30);
  });

  it("requires a cash-out for every player", async () => {
    const { banker, game, a } = await setup();
    signInAs(banker);

    const { status, body } = await read(await close(game.id, { cashouts: [{ participantId: a.id, amount: 20 }] }));
    expect(status).toBe(400);
    expect(body.error).toMatch(/every player/i);
    expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).status).toBe("ACTIVE");
  });

  it("rejects the same player listed twice in place of someone else", async () => {
    const { banker, game, a } = await setup();
    signInAs(banker);

    const { status } = await read(
      await close(game.id, {
        cashouts: [
          { participantId: a.id, amount: 20 },
          { participantId: a.id, amount: 20 },
        ],
      })
    );
    expect(status).toBe(400);
    expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).status).toBe("ACTIVE");
  });

  it("rejects participants that aren't in this game", async () => {
    const { banker, game, a } = await setup();
    signInAs(banker);

    const { status } = await read(
      await close(game.id, {
        cashouts: [
          { participantId: a.id, amount: 20 },
          { participantId: "someone-else", amount: 20 },
        ],
      })
    );
    expect(status).toBe(400);
  });

  it.each([
    ["an empty list", { cashouts: [] }],
    ["a negative amount", { cashouts: [{ participantId: "x", amount: -1 }] }],
    ["no body fields", {}],
  ])("rejects %s", async (_label, payload) => {
    const { banker, game } = await setup();
    signInAs(banker);
    expect((await close(game.id, payload)).status).toBe(400);
  });

  it("only lets the game's creator close it", async () => {
    const { game, a, b } = await setup();
    signInAs(await createUser());
    const res = await close(game.id, {
      cashouts: [
        { participantId: a.id, amount: 20 },
        { participantId: b.id, amount: 20 },
      ],
    });
    expect(res.status).toBe(403);
    expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).status).toBe("ACTIVE");
  });

  it("can't close a game twice", async () => {
    const banker = await createUser();
    const [a] = await createGuests(banker, 1);
    const { game, participants } = await createGame({
      creator: banker,
      status: "COMPLETED",
      seats: [{ guest: a, cashedOut: 20 }],
    });
    signInAs(banker);
    expect((await close(game.id, { cashouts: [{ participantId: participants[0].id, amount: 20 }] })).status).toBe(400);
  });

  it("404s for an unknown game and requires login", async () => {
    signInAs(await createUser());
    expect((await close("nope", { cashouts: [{ participantId: "x", amount: 1 }] })).status).toBe(404);
    signInAs(null);
    expect((await close("nope", { cashouts: [{ participantId: "x", amount: 1 }] })).status).toBe(401);
  });
});
