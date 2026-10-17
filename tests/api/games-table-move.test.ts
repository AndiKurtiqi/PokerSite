import { describe, expect, it } from "vitest";
import { PATCH } from "@/app/api/games/[id]/participants/[participantId]/table/route";
import { prisma } from "@/lib/prisma";
import { createGame, createGuests, createUser, ctx, jsonRequest, read, signInAs } from "../support/factories";

const move = (gameId: string, participantId: string, body: unknown) =>
  PATCH(jsonRequest("PATCH", body), ctx({ id: gameId, participantId }));

const tableOf = async (participantId: string) =>
  (await prisma.gameParticipant.findUniqueOrThrow({ where: { id: participantId } })).tableNumber;

describe("PATCH .../table (shuffle a player between tables)", () => {
  it("moves a player to another table", async () => {
    const banker = await createUser();
    const guests = await createGuests(banker, 2);
    const { game, participants } = await createGame({
      creator: banker,
      seats: [
        { guest: guests[0], table: 1 },
        { guest: guests[1], table: 2 },
      ],
    });
    signInAs(banker);

    expect((await move(game.id, participants[0].id, { tableNumber: 2 })).status).toBe(200);
    expect(await tableOf(participants[0].id)).toBe(2);
  });

  it("can open a brand new table", async () => {
    const banker = await createUser();
    const [guest] = await createGuests(banker, 1);
    const { game, participants } = await createGame({ creator: banker, seats: [{ guest, table: 1 }] });
    signInAs(banker);

    expect((await move(game.id, participants[0].id, { tableNumber: 3 })).status).toBe(200);
    expect(await tableOf(participants[0].id)).toBe(3);
  });

  it("is a harmless no-op when the player is already at that table", async () => {
    const banker = await createUser();
    const [guest] = await createGuests(banker, 1);
    const { game, participants } = await createGame({ creator: banker, seats: [{ guest, table: 1 }] });
    signInAs(banker);

    expect((await move(game.id, participants[0].id, { tableNumber: 1 })).status).toBe(200);
    expect(await tableOf(participants[0].id)).toBe(1);
  });

  it("refuses to overfill a table (9 max) and leaves the player where they were", async () => {
    const banker = await createUser();
    const full = await createGuests(banker, 9);
    const [mover] = await createGuests(banker, 1);
    const { game, participants } = await createGame({
      creator: banker,
      seats: [...full.map((guest) => ({ guest, table: 1 })), { guest: mover, table: 2 }],
    });
    signInAs(banker);

    const { status, body } = await read(await move(game.id, participants[9].id, { tableNumber: 1 }));
    expect(status).toBe(400);
    expect(body.error).toMatch(/full/i);
    expect(await tableOf(participants[9].id)).toBe(2);
  });

  it("allows moving into a table that has exactly 8 players", async () => {
    const banker = await createUser();
    const eight = await createGuests(banker, 8);
    const [mover] = await createGuests(banker, 1);
    const { game, participants } = await createGame({
      creator: banker,
      seats: [...eight.map((guest) => ({ guest, table: 1 })), { guest: mover, table: 2 }],
    });
    signInAs(banker);

    expect((await move(game.id, participants[8].id, { tableNumber: 1 })).status).toBe(200);
    expect(await prisma.gameParticipant.count({ where: { gameId: game.id, tableNumber: 1 } })).toBe(9);
  });

  it.each([[0], [-1], [1.5]])("rejects table number %s", async (tableNumber) => {
    const banker = await createUser();
    const [guest] = await createGuests(banker, 1);
    const { game, participants } = await createGame({ creator: banker, seats: [{ guest }] });
    signInAs(banker);
    expect((await move(game.id, participants[0].id, { tableNumber })).status).toBe(400);
  });

  it("only lets the game's creator move players", async () => {
    const banker = await createUser();
    const [guest] = await createGuests(banker, 1);
    const { game, participants } = await createGame({ creator: banker, seats: [{ guest, table: 1 }] });
    signInAs(await createUser());

    expect((await move(game.id, participants[0].id, { tableNumber: 2 })).status).toBe(403);
    expect(await tableOf(participants[0].id)).toBe(1);
  });

  it("refuses once the game is closed", async () => {
    const banker = await createUser();
    const [guest] = await createGuests(banker, 1);
    const { game, participants } = await createGame({
      creator: banker,
      status: "COMPLETED",
      seats: [{ guest, table: 1, cashedOut: 20 }],
    });
    signInAs(banker);
    expect((await move(game.id, participants[0].id, { tableNumber: 2 })).status).toBe(400);
  });

  it("404s for an unknown game or participant, and requires login", async () => {
    const banker = await createUser();
    const { game } = await createGame({ creator: banker });
    signInAs(banker);
    expect((await move("nope", "x", { tableNumber: 2 })).status).toBe(404);
    expect((await move(game.id, "x", { tableNumber: 2 })).status).toBe(404);
    signInAs(null);
    expect((await move(game.id, "x", { tableNumber: 2 })).status).toBe(401);
  });

  it("doesn't count cashed-out players toward a table's 9 seats", async () => {
    const banker = await createUser();
    const full = await createGuests(banker, 9);
    const [mover] = await createGuests(banker, 1);
    const { game, participants } = await createGame({
      creator: banker,
      seats: [
        ...full.map((guest, i) => ({ guest, table: 1, cashedOut: i === 0 ? 20 : null })),
        { guest: mover, table: 2 },
      ],
    });
    signInAs(banker);

    expect((await move(game.id, participants[9].id, { tableNumber: 1 })).status).toBe(200);
    expect(await tableOf(participants[9].id)).toBe(1);
  });

  it("lets a cashed-out player be moved even to a full table (they hold no seat)", async () => {
    const banker = await createUser();
    const full = await createGuests(banker, 9);
    const [gone] = await createGuests(banker, 1);
    const { game, participants } = await createGame({
      creator: banker,
      seats: [...full.map((guest) => ({ guest, table: 1 })), { guest: gone, table: 2, cashedOut: 20 }],
    });
    signInAs(banker);

    expect((await move(game.id, participants[9].id, { tableNumber: 1 })).status).toBe(200);
  });
});
