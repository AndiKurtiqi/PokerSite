import { describe, expect, it } from "vitest";
import { getLeaderboardRows } from "@/lib/get-leaderboard-rows";
import { prisma } from "@/lib/prisma";
import { createGame, createGuest, createUser } from "../support/factories";

const byName = (rows: Awaited<ReturnType<typeof getLeaderboardRows>>, name: string) => {
  const row = rows.find((r) => r.displayName === name);
  if (!row) throw new Error(`no leaderboard row for ${name}`);
  return row;
};

describe("getLeaderboardRows (what the dashboard and /leaderboard show)", () => {
  it("is empty when there are no games", async () => {
    expect(await getLeaderboardRows()).toEqual([]);
  });

  it("totals completed games for both accounts and guests", async () => {
    const andi = await createUser({ displayName: "Andi" });
    const mike = await createGuest(andi, "Mike");
    await createGame({
      creator: andi,
      status: "COMPLETED",
      seats: [
        { user: andi, cashedOut: 35 },
        { guest: mike, cashedOut: 5 },
      ],
    });
    await createGame({
      creator: andi,
      status: "COMPLETED",
      seats: [
        { user: andi, cashedOut: 10 },
        { guest: mike, cashedOut: 30 },
      ],
    });

    const rows = await getLeaderboardRows();
    expect(rows).toHaveLength(2);
    // Andi: in 40, out 35 + 10 = 45 -> +5.  Mike: in 40, out 5 + 30 = 35 -> -5.
    expect(byName(rows, "Andi")).toMatchObject({ netProfit: 5, sessionsPlayed: 2, isGuest: false });
    expect(byName(rows, "Mike")).toMatchObject({ netProfit: -5, sessionsPlayed: 2, isGuest: true });
  });

  it("ignores games that are still in progress", async () => {
    const andi = await createUser({ displayName: "Andi" });
    await createGame({ creator: andi, status: "ACTIVE", seats: [{ user: andi }] });
    expect(await getLeaderboardRows()).toEqual([]);
  });

  it("ignores a participant who hasn't been cashed out", async () => {
    const andi = await createUser({ displayName: "Andi" });
    const guest = await createGuest(andi, "Ghost");
    await createGame({
      creator: andi,
      status: "COMPLETED",
      seats: [{ user: andi, cashedOut: 25 }, { guest }],
    });
    expect((await getLeaderboardRows()).map((r) => r.displayName)).toEqual(["Andi"]);
  });

  it("counts rebuys as money in", async () => {
    const andi = await createUser({ displayName: "Andi" });
    await createGame({
      creator: andi,
      status: "COMPLETED",
      seats: [{ user: andi, boughtIn: 50, cashedOut: 60 }],
    });
    expect(byName(await getLeaderboardRows(), "Andi")).toMatchObject({
      totalBoughtIn: 50,
      totalCashedOut: 60,
      netProfit: 10,
    });
  });

  it("flags a hot streak across the most recent completed games", async () => {
    const andi = await createUser({ displayName: "Andi" });
    for (const [day, cashedOut] of [[1, 30], [2, 30], [3, 30]] as const) {
      await createGame({
        creator: andi,
        status: "COMPLETED",
        endedAt: new Date(2026, 0, day),
        seats: [{ user: andi, cashedOut }],
      });
    }
    expect(byName(await getLeaderboardRows(), "Andi").streak).toEqual({ type: "hot", length: 3 });
  });

  it("drops a game's results from everyone's stats when it's deleted", async () => {
    const andi = await createUser({ displayName: "Andi" });
    const { game } = await createGame({ creator: andi, status: "COMPLETED", seats: [{ user: andi, cashedOut: 40 }] });
    expect(await getLeaderboardRows()).toHaveLength(1);

    await prisma.game.delete({ where: { id: game.id } });
    expect(await getLeaderboardRows()).toEqual([]);
  });
});
