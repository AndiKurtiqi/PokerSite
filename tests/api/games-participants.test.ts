import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/games/[id]/participants/route";
import { prisma } from "@/lib/prisma";
import {
  createGame,
  createGuest,
  createGuests,
  createUser,
  ctx,
  jsonRequest,
  num,
  read,
  signInAs,
} from "../support/factories";

const add = (gameId: string, body: unknown) => POST(jsonRequest("POST", body), ctx({ id: gameId }));

describe("POST /api/games/[id]/participants (banker adds a player mid-game)", () => {
  it("adds a guest with a BUY_IN transaction", async () => {
    const banker = await createUser();
    const guest = await createGuest(banker, "Late Larry");
    const { game } = await createGame({ creator: banker });
    signInAs(banker);

    const { status, body } = await read(await add(game.id, { type: "guest", id: guest.id, amount: 20 }));
    expect(status).toBe(200);

    const p = await prisma.gameParticipant.findUniqueOrThrow({
      where: { id: body.participant.id },
      include: { transactions: true },
    });
    expect(p.guestId).toBe(guest.id);
    expect(p.userId).toBeNull();
    expect(num(p.totalBoughtIn)).toBe(20);
    expect(p.transactions).toHaveLength(1);
  });

  it("adds a registered user and accepts a custom buy-in", async () => {
    const banker = await createUser();
    const friend = await createUser();
    const { game } = await createGame({ creator: banker });
    signInAs(banker);

    const { body } = await read(await add(game.id, { type: "user", id: friend.id, amount: 50 }));
    const p = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: body.participant.id } });
    expect(p.userId).toBe(friend.id);
    expect(num(p.totalBoughtIn)).toBe(50);
  });

  it("puts new players at the first table with room", async () => {
    const banker = await createUser();
    const seated = await createGuests(banker, 9);
    const newcomer = await createGuest(banker);
    const { game } = await createGame({ creator: banker, seats: seated.map((guest) => ({ guest, table: 1 })) });
    signInAs(banker);

    const { body } = await read(await add(game.id, { type: "guest", id: newcomer.id, amount: 20 }));
    const p = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: body.participant.id } });
    expect(p.tableNumber).toBe(2);
  });

  it("reuses a seat at Table 1 once someone there has cashed out", async () => {
    const banker = await createUser();
    const seated = await createGuests(banker, 9);
    const newcomer = await createGuest(banker);
    const { game } = await createGame({
      creator: banker,
      seats: seated.map((guest, i) => ({ guest, table: 1, cashedOut: i === 0 ? 35 : null })),
    });
    signInAs(banker);

    const { body } = await read(await add(game.id, { type: "guest", id: newcomer.id, amount: 20 }));
    const p = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: body.participant.id } });
    expect(p.tableNumber).toBe(1); // 8 still playing + 1 cashed out = a free seat
  });

  it("returns 409 (not a crash) when the same guest is added twice", async () => {
    const banker = await createUser();
    const guest = await createGuest(banker);
    const { game } = await createGame({ creator: banker, seats: [{ guest }] });
    signInAs(banker);

    const { status, body } = await read(await add(game.id, { type: "guest", id: guest.id, amount: 20 }));
    expect(status).toBe(409);
    expect(body.error).toMatch(/already in this game/i);
    expect(await prisma.gameParticipant.count({ where: { gameId: game.id } })).toBe(1);
  });

  it("returns 409 when the same registered user is added twice", async () => {
    const banker = await createUser();
    const friend = await createUser();
    const { game } = await createGame({ creator: banker, seats: [{ user: friend }] });
    signInAs(banker);

    expect((await add(game.id, { type: "user", id: friend.id, amount: 20 })).status).toBe(409);
  });

  it("only lets the game's creator add players", async () => {
    const banker = await createUser();
    const intruder = await createUser();
    const guest = await createGuest(intruder);
    const { game } = await createGame({ creator: banker });
    signInAs(intruder);

    expect((await add(game.id, { type: "guest", id: guest.id, amount: 20 })).status).toBe(403);
    expect(await prisma.gameParticipant.count()).toBe(0);
  });

  it("refuses to add players to a closed game", async () => {
    const banker = await createUser();
    const guest = await createGuest(banker);
    const { game } = await createGame({ creator: banker, status: "COMPLETED" });
    signInAs(banker);
    expect((await add(game.id, { type: "guest", id: guest.id, amount: 20 })).status).toBe(400);
  });

  it("rejects a guest that has been merged into an account", async () => {
    const banker = await createUser();
    const target = await createUser();
    const guest = await createGuest(banker);
    await prisma.guest.update({ where: { id: guest.id }, data: { mergedIntoId: target.id } });
    const { game } = await createGame({ creator: banker });
    signInAs(banker);

    expect((await add(game.id, { type: "guest", id: guest.id, amount: 20 })).status).toBe(400);
  });

  it("rejects users who aren't approved and players that don't exist", async () => {
    const banker = await createUser();
    const pending = await createUser({ status: "PENDING" });
    const { game } = await createGame({ creator: banker });
    signInAs(banker);

    expect((await add(game.id, { type: "user", id: pending.id, amount: 20 })).status).toBe(400);
    expect((await add(game.id, { type: "guest", id: "ghost", amount: 20 })).status).toBe(400);
  });

  it("rejects a non-positive buy-in", async () => {
    const banker = await createUser();
    const guest = await createGuest(banker);
    const { game } = await createGame({ creator: banker });
    signInAs(banker);
    expect((await add(game.id, { type: "guest", id: guest.id, amount: 0 })).status).toBe(400);
  });

  it("404s for an unknown game and requires login", async () => {
    signInAs(await createUser());
    expect((await add("nope", { type: "guest", id: "x", amount: 20 })).status).toBe(404);
    signInAs(null);
    expect((await add("nope", { type: "guest", id: "x", amount: 20 })).status).toBe(401);
  });
});
