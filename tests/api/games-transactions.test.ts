import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/games/[id]/participants/[participantId]/transactions/route";
import { prisma } from "@/lib/prisma";
import {
  createAdmin,
  createGame,
  createGuests,
  createUser,
  ctx,
  jsonRequest,
  num,
  read,
  signInAs,
} from "../support/factories";

const record = (gameId: string, participantId: string, body: unknown) =>
  POST(jsonRequest("POST", body), ctx({ id: gameId, participantId }));

async function setup() {
  const banker = await createUser();
  const [guest] = await createGuests(banker, 1);
  const { game, participants } = await createGame({ creator: banker, seats: [{ guest }] });
  return { banker, game, participant: participants[0] };
}

describe("POST .../transactions — rebuys", () => {
  it("adds the amount to total bought in and records a REBUY", async () => {
    const { banker, game, participant } = await setup();
    signInAs(banker);

    const { status } = await read(await record(game.id, participant.id, { type: "REBUY", amount: 15 }));
    expect(status).toBe(200);

    const saved = await prisma.gameParticipant.findUniqueOrThrow({
      where: { id: participant.id },
      include: { transactions: { orderBy: { createdAt: "asc" } } },
    });
    expect(num(saved.totalBoughtIn)).toBe(35);
    expect(saved.transactions.map((t) => [t.type, num(t.amount)])).toEqual([
      ["BUY_IN", 20],
      ["REBUY", 15],
    ]);
  });

  it("stacks multiple rebuys", async () => {
    const { banker, game, participant } = await setup();
    signInAs(banker);
    await record(game.id, participant.id, { type: "REBUY", amount: 10 });
    await record(game.id, participant.id, { type: "REBUY", amount: 10 });
    const saved = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: participant.id } });
    expect(num(saved.totalBoughtIn)).toBe(40);
  });

  it.each([[0], [-5]])("rejects a rebuy of %i", async (amount) => {
    const { banker, game, participant } = await setup();
    signInAs(banker);
    expect((await record(game.id, participant.id, { type: "REBUY", amount })).status).toBe(400);
    const saved = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: participant.id } });
    expect(num(saved.totalBoughtIn)).toBe(20);
  });
});

describe("POST .../transactions — cash-outs", () => {
  it("sets total cashed out, marks the player as left, and records a CASH_OUT", async () => {
    const { banker, game, participant } = await setup();
    signInAs(banker);

    expect((await record(game.id, participant.id, { type: "CASH_OUT", amount: 45 })).status).toBe(200);

    const saved = await prisma.gameParticipant.findUniqueOrThrow({
      where: { id: participant.id },
      include: { transactions: true },
    });
    expect(num(saved.totalCashedOut)).toBe(45);
    expect(saved.leftAt).not.toBeNull();
    expect(saved.transactions.some((t) => t.type === "CASH_OUT" && num(t.amount) === 45)).toBe(true);
  });

  it("allows a $0 cash-out (busting out with nothing)", async () => {
    const { banker, game, participant } = await setup();
    signInAs(banker);

    expect((await record(game.id, participant.id, { type: "CASH_OUT", amount: 0 })).status).toBe(200);
    const saved = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: participant.id } });
    expect(saved.totalCashedOut).not.toBeNull();
    expect(num(saved.totalCashedOut)).toBe(0);
  });

  it("rejects a negative cash-out", async () => {
    const { banker, game, participant } = await setup();
    signInAs(banker);
    expect((await record(game.id, participant.id, { type: "CASH_OUT", amount: -1 })).status).toBe(400);
  });
});

describe("POST .../transactions — permissions and state", () => {
  it("only lets the game's creator record transactions", async () => {
    const { game, participant } = await setup();
    signInAs(await createUser());
    expect((await record(game.id, participant.id, { type: "REBUY", amount: 10 })).status).toBe(403);
  });

  it("keeps transactions banker-only even for admins who aren't the banker", async () => {
    const { game, participant } = await setup();
    signInAs(await createAdmin());
    expect((await record(game.id, participant.id, { type: "REBUY", amount: 10 })).status).toBe(403);
  });

  it("refuses changes once the game is closed", async () => {
    const banker = await createUser();
    const [guest] = await createGuests(banker, 1);
    const { game, participants } = await createGame({
      creator: banker,
      status: "COMPLETED",
      seats: [{ guest, cashedOut: 20 }],
    });
    signInAs(banker);
    expect((await record(game.id, participants[0].id, { type: "REBUY", amount: 10 })).status).toBe(400);
  });

  it("404s for a participant from a different game", async () => {
    const { banker, game } = await setup();
    const [otherGuest] = await createGuests(banker, 1);
    const other = await createGame({ creator: banker, seats: [{ guest: otherGuest }] });
    signInAs(banker);
    expect((await record(game.id, other.participants[0].id, { type: "REBUY", amount: 10 })).status).toBe(404);
  });

  it("rejects an unknown transaction type", async () => {
    const { banker, game, participant } = await setup();
    signInAs(banker);
    expect((await record(game.id, participant.id, { type: "BUY_IN", amount: 10 })).status).toBe(400);
  });

  it("404s for an unknown game and requires login", async () => {
    signInAs(await createUser());
    expect((await record("nope", "nope", { type: "REBUY", amount: 10 })).status).toBe(404);
    signInAs(null);
    expect((await record("nope", "nope", { type: "REBUY", amount: 10 })).status).toBe(401);
  });
});
