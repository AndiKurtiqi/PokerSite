import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/games/[id]/join/route";
import { prisma } from "@/lib/prisma";
import {
  createGame,
  createGuests,
  createUser,
  ctx,
  jsonRequest,
  num,
  read,
  signInAs,
} from "../support/factories";

const join = (gameId: string, body: unknown = { amount: 20 }) =>
  POST(jsonRequest("POST", body), ctx({ id: gameId }));

describe("POST /api/games/[id]/join (self-join)", () => {
  it("adds the caller as a participant with a BUY_IN transaction", async () => {
    const banker = await createUser();
    const joiner = await createUser();
    const { game } = await createGame({ creator: banker, seats: [] });
    signInAs(joiner);

    const { status, body } = await read(await join(game.id, { amount: 35 }));
    expect(status).toBe(200);

    const p = await prisma.gameParticipant.findUniqueOrThrow({
      where: { id: body.participant.id },
      include: { transactions: true },
    });
    expect(p.userId).toBe(joiner.id);
    expect(num(p.totalBoughtIn)).toBe(35);
    expect(p.transactions.map((t) => [t.type, num(t.amount)])).toEqual([["BUY_IN", 35]]);
  });

  it("seats the joiner at Table 1 when it has room", async () => {
    const banker = await createUser();
    const joiner = await createUser();
    const guests = await createGuests(banker, 3);
    const { game } = await createGame({ creator: banker, seats: guests.map((guest) => ({ guest })) });
    signInAs(joiner);

    const { body } = await read(await join(game.id));
    const p = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: body.participant.id } });
    expect(p.tableNumber).toBe(1);
  });

  it("overflows to Table 2 once Table 1 has 9 players", async () => {
    const banker = await createUser();
    const joiner = await createUser();
    const guests = await createGuests(banker, 9);
    const { game } = await createGame({ creator: banker, seats: guests.map((guest) => ({ guest, table: 1 })) });
    signInAs(joiner);

    const { body } = await read(await join(game.id));
    const p = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: body.participant.id } });
    expect(p.tableNumber).toBe(2);
  });

  it("seats a joiner at Table 1 when a player there has cashed out", async () => {
    const banker = await createUser();
    const joiner = await createUser();
    const guests = await createGuests(banker, 9);
    const { game } = await createGame({
      creator: banker,
      seats: guests.map((guest, i) => ({ guest, table: 1, cashedOut: i < 2 ? 20 : null })),
    });
    signInAs(joiner);

    const { body } = await read(await join(game.id));
    const p = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: body.participant.id } });
    expect(p.tableNumber).toBe(1);
  });

  it("refuses to seat someone who is already in the game", async () => {
    const banker = await createUser();
    const { game } = await createGame({ creator: banker, seats: [{ user: banker }] });
    signInAs(banker);

    const { status, body } = await read(await join(game.id));
    expect(status).toBe(400);
    expect(body.error).toMatch(/already in this game/i);
    expect(await prisma.gameParticipant.count({ where: { gameId: game.id } })).toBe(1);
  });

  it("refuses to join a closed game", async () => {
    const banker = await createUser();
    const joiner = await createUser();
    const { game } = await createGame({ creator: banker, status: "COMPLETED" });
    signInAs(joiner);

    const { status, body } = await read(await join(game.id));
    expect(status).toBe(400);
    expect(body.error).toMatch(/closed/i);
  });

  it.each([[0], [-10]])("rejects a buy-in of %i", async (amount) => {
    const banker = await createUser();
    const joiner = await createUser();
    const { game } = await createGame({ creator: banker });
    signInAs(joiner);
    expect((await join(game.id, { amount })).status).toBe(400);
    expect(await prisma.gameParticipant.count()).toBe(0);
  });

  it("404s for an unknown game", async () => {
    signInAs(await createUser());
    expect((await join("nope")).status).toBe(404);
  });

  it("requires login", async () => {
    signInAs(null);
    expect((await join("x")).status).toBe(401);
  });
});
