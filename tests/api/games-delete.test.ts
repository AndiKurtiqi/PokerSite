import { describe, expect, it } from "vitest";
import { DELETE } from "@/app/api/games/[id]/route";
import { prisma } from "@/lib/prisma";
import { createAdmin, createGame, createGuests, createUser, ctx, jsonRequest, read, signInAs } from "../support/factories";

const remove = (gameId: string) => DELETE(jsonRequest("DELETE"), ctx({ id: gameId }));

async function setup(status: "ACTIVE" | "COMPLETED" = "COMPLETED") {
  const banker = await createUser();
  const guests = await createGuests(banker, 2);
  const { game } = await createGame({
    creator: banker,
    status,
    seats: guests.map((guest) => ({ guest, cashedOut: status === "COMPLETED" ? 20 : null })),
  });
  return { banker, guests, game };
}

describe("DELETE /api/games/[id]", () => {
  it("lets the creator delete a completed game", async () => {
    const { banker, game } = await setup("COMPLETED");
    signInAs(banker);

    expect((await remove(game.id)).status).toBe(200);
    expect(await prisma.game.findUnique({ where: { id: game.id } })).toBeNull();
  });

  it("lets the creator delete an active game", async () => {
    const { banker, game } = await setup("ACTIVE");
    signInAs(banker);
    expect((await remove(game.id)).status).toBe(200);
    expect(await prisma.game.count()).toBe(0);
  });

  it("cascades to participants and transactions but keeps people and guests", async () => {
    const { banker, guests, game } = await setup("COMPLETED");
    signInAs(banker);
    expect(await prisma.gameParticipant.count()).toBe(2);
    expect(await prisma.transaction.count()).toBeGreaterThan(0);

    await remove(game.id);

    expect(await prisma.gameParticipant.count()).toBe(0);
    expect(await prisma.transaction.count()).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: banker.id } })).not.toBeNull();
    expect(await prisma.guest.count({ where: { id: { in: guests.map((g) => g.id) } } })).toBe(2);
  });

  it("only deletes the targeted game", async () => {
    const { banker, game } = await setup("COMPLETED");
    const other = await createGame({ creator: banker });
    signInAs(banker);

    await remove(game.id);
    expect(await prisma.game.findUnique({ where: { id: other.game.id } })).not.toBeNull();
  });

  it("lets an admin delete someone else's game", async () => {
    const { game } = await setup("COMPLETED");
    signInAs(await createAdmin());
    expect((await remove(game.id)).status).toBe(200);
    expect(await prisma.game.count()).toBe(0);
  });

  it("forbids other players from deleting someone else's game", async () => {
    const { game } = await setup("COMPLETED");
    signInAs(await createUser());

    const { status, body } = await read(await remove(game.id));
    expect(status).toBe(403);
    expect(body.error).toMatch(/creator or an admin/i);
    expect(await prisma.game.count()).toBe(1);
  });

  it("404s for an unknown game and requires login", async () => {
    signInAs(await createUser());
    expect((await remove("nope")).status).toBe(404);
    signInAs(null);
    expect((await remove("nope")).status).toBe(401);
  });
});
