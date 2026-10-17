import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/guests/[id]/merge/route";
import { getLeaderboardRows } from "@/lib/get-leaderboard-rows";
import { prisma } from "@/lib/prisma";
import { createAdmin, createGame, createGuest, createUser, ctx, jsonRequest, num, read, signInAs } from "../support/factories";

const merge = (guestId: string, body: unknown) => POST(jsonRequest("POST", body), ctx({ id: guestId }));

describe("POST /api/admin/guests/[id]/merge", () => {
  it("moves the guest's whole history onto the real account", async () => {
    const admin = await createAdmin();
    const guest = await createGuest(admin, "Mike");
    const mike = await createUser({ displayName: "Mike Real" });
    await createGame({ creator: admin, status: "COMPLETED", seats: [{ guest, cashedOut: 30 }] });
    await createGame({ creator: admin, status: "COMPLETED", seats: [{ guest, cashedOut: 10 }] });
    signInAs(admin);

    const { status, body } = await read(await merge(guest.id, { targetUserId: mike.id }));
    expect(status).toBe(200);
    expect(body.mergedSessions).toBe(2);

    expect(await prisma.gameParticipant.count({ where: { guestId: guest.id } })).toBe(0);
    expect(await prisma.gameParticipant.count({ where: { userId: mike.id } })).toBe(2);
    expect((await prisma.guest.findUniqueOrThrow({ where: { id: guest.id } })).mergedIntoId).toBe(mike.id);
  });

  it("makes the stats show up under the account on the leaderboard", async () => {
    const admin = await createAdmin();
    const guest = await createGuest(admin, "Mike");
    const mike = await createUser({ displayName: "Mike Real" });
    await createGame({ creator: admin, status: "COMPLETED", seats: [{ guest, cashedOut: 30 }] });

    expect((await getLeaderboardRows()).map((r) => r.key)).toEqual([`guest:${guest.id}`]);

    signInAs(admin);
    await merge(guest.id, { targetUserId: mike.id });

    const rows = await getLeaderboardRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe(`user:${mike.id}`);
    expect(rows[0].isGuest).toBe(false);
    expect(rows[0].netProfit).toBe(10);
  });

  it("refuses (409) when the account already has a seat in one of the guest's games, changing nothing", async () => {
    const admin = await createAdmin();
    const guest = await createGuest(admin, "Mike");
    const mike = await createUser();
    await createGame({
      creator: admin,
      status: "COMPLETED",
      seats: [
        { guest, cashedOut: 20 },
        { user: mike, cashedOut: 20 },
      ],
    });
    signInAs(admin);

    const { status, body } = await read(await merge(guest.id, { targetUserId: mike.id }));
    expect(status).toBe(409);
    expect(body.error).toMatch(/already has a seat/i);
    expect(await prisma.gameParticipant.count({ where: { guestId: guest.id } })).toBe(1);
    expect((await prisma.guest.findUniqueOrThrow({ where: { id: guest.id } })).mergedIntoId).toBeNull();
  });

  it("can merge a guest who never played (0 sessions)", async () => {
    const admin = await createAdmin();
    const guest = await createGuest(admin);
    const user = await createUser();
    signInAs(admin);

    const { status, body } = await read(await merge(guest.id, { targetUserId: user.id }));
    expect(status).toBe(200);
    expect(body.mergedSessions).toBe(0);
  });

  it("can't merge the same guest twice", async () => {
    const admin = await createAdmin();
    const guest = await createGuest(admin);
    const user = await createUser();
    signInAs(admin);

    await merge(guest.id, { targetUserId: user.id });
    const { status, body } = await read(await merge(guest.id, { targetUserId: user.id }));
    expect(status).toBe(400);
    expect(body.error).toMatch(/already been merged/i);
  });

  it("only merges into approved accounts that exist", async () => {
    const admin = await createAdmin();
    const guest = await createGuest(admin);
    const pending = await createUser({ status: "PENDING" });
    signInAs(admin);

    expect((await merge(guest.id, { targetUserId: pending.id })).status).toBe(400);
    expect((await merge(guest.id, { targetUserId: "ghost" })).status).toBe(400);
    expect((await prisma.guest.findUniqueOrThrow({ where: { id: guest.id } })).mergedIntoId).toBeNull();
  });

  it("404s for an unknown guest", async () => {
    const admin = await createAdmin();
    const user = await createUser();
    signInAs(admin);
    expect((await merge("nope", { targetUserId: user.id })).status).toBe(404);
  });

  it("is admin-only", async () => {
    const player = await createUser();
    const guest = await createGuest(player);
    const target = await createUser();

    signInAs(player);
    expect((await merge(guest.id, { targetUserId: target.id })).status).toBe(403);
    signInAs(null);
    expect((await merge(guest.id, { targetUserId: target.id })).status).toBe(403);
    expect((await prisma.guest.findUniqueOrThrow({ where: { id: guest.id } })).mergedIntoId).toBeNull();
  });

  describe("merging into another guest", () => {
    it("moves the history onto the other guest and hides the merged one", async () => {
      const admin = await createAdmin();
      const bankerB = await createUser();
      const keep = await createGuest(admin, "Mike");
      const dupe = await createGuest(bankerB, "Mike B.");
      await createGame({ creator: admin, status: "COMPLETED", seats: [{ guest: keep, cashedOut: 30 }] });
      await createGame({ creator: bankerB, status: "COMPLETED", seats: [{ guest: dupe, cashedOut: 10 }] });
      signInAs(admin);

      const { status, body } = await read(await merge(dupe.id, { targetGuestId: keep.id }));
      expect(status).toBe(200);
      expect(body.mergedSessions).toBe(1);

      expect(await prisma.gameParticipant.count({ where: { guestId: keep.id } })).toBe(2);
      expect(await prisma.gameParticipant.count({ where: { guestId: dupe.id } })).toBe(0);
      expect((await prisma.guest.findUniqueOrThrow({ where: { id: dupe.id } })).mergedIntoId).toBe(keep.id);
    });

    it("collapses the duplicate leaderboard rows into one", async () => {
      const admin = await createAdmin();
      const keep = await createGuest(admin, "Mike");
      const dupe = await createGuest(admin, "Mike B.");
      await createGame({ creator: admin, status: "COMPLETED", seats: [{ guest: keep, cashedOut: 30 }] });
      await createGame({ creator: admin, status: "COMPLETED", seats: [{ guest: dupe, cashedOut: 10 }] });
      expect(await getLeaderboardRows()).toHaveLength(2);

      signInAs(admin);
      await merge(dupe.id, { targetGuestId: keep.id });

      const rows = await getLeaderboardRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].key).toBe(`guest:${keep.id}`);
      expect(rows[0].netProfit).toBe(0); // (30-20) + (10-20)
      expect(rows[0].sessionsPlayed).toBe(2);
    });

    it("refuses (409) when both guests sat in the same game, changing nothing", async () => {
      const admin = await createAdmin();
      const keep = await createGuest(admin, "Mike");
      const dupe = await createGuest(admin, "Mike B.");
      await createGame({
        creator: admin,
        status: "COMPLETED",
        seats: [
          { guest: keep, cashedOut: 20 },
          { guest: dupe, cashedOut: 20 },
        ],
      });
      signInAs(admin);

      const { status, body } = await read(await merge(dupe.id, { targetGuestId: keep.id }));
      expect(status).toBe(409);
      expect(body.error).toMatch(/already has a seat/i);
      expect((await prisma.guest.findUniqueOrThrow({ where: { id: dupe.id } })).mergedIntoId).toBeNull();
    });

    it("rejects merging a guest into itself, an unknown guest, or an already-merged guest", async () => {
      const admin = await createAdmin();
      const a = await createGuest(admin, "A");
      const b = await createGuest(admin, "B");
      const c = await createGuest(admin, "C");
      signInAs(admin);

      expect((await merge(a.id, { targetGuestId: a.id })).status).toBe(400);
      expect((await merge(a.id, { targetGuestId: "ghost" })).status).toBe(400);

      await merge(b.id, { targetGuestId: c.id });
      expect((await merge(a.id, { targetGuestId: b.id })).status).toBe(400); // b already merged away
    });

    it("needs exactly one target", async () => {
      const admin = await createAdmin();
      const guest = await createGuest(admin);
      const other = await createGuest(admin);
      const user = await createUser();
      signInAs(admin);

      expect((await merge(guest.id, {})).status).toBe(400);
      expect(
        (await merge(guest.id, { targetUserId: user.id, targetGuestId: other.id })).status
      ).toBe(400);
    });
  });

  describe("combining seats when both already sit in the same game", () => {
    // The usual cause: someone rebought by being added as a second guest.
    it("offers to combine instead of merging, and changes nothing until confirmed", async () => {
      const admin = await createAdmin();
      const aidan = await createUser({ displayName: "Aidan Ludwig" });
      const dupe = await createGuest(admin, "Aiden Ludwig");
      await createGame({
        creator: admin,
        status: "COMPLETED",
        seats: [
          { user: aidan, cashedOut: 10 },
          { guest: dupe, boughtIn: 20, cashedOut: 50 },
        ],
      });
      signInAs(admin);

      const { status, body } = await read(await merge(dupe.id, { targetUserId: aidan.id }));
      expect(status).toBe(409);
      expect(body.canCombine).toBe(true);
      expect(body.overlaps).toBe(1);
      expect(await prisma.gameParticipant.count({ where: { guestId: dupe.id } })).toBe(1);
    });

    it("with combineSeats, adds the two seats together into one and keeps all transactions", async () => {
      const admin = await createAdmin();
      const aidan = await createUser({ displayName: "Aidan Ludwig" });
      const dupe = await createGuest(admin, "Aiden Ludwig");
      const { game } = await createGame({
        creator: admin,
        status: "COMPLETED",
        seats: [
          { user: aidan, boughtIn: 20, cashedOut: 10 },
          { guest: dupe, boughtIn: 20, cashedOut: 50 },
        ],
      });
      signInAs(admin);

      const { status, body } = await read(await merge(dupe.id, { targetUserId: aidan.id, combineSeats: true }));
      expect(status).toBe(200);
      expect(body.combinedSeats).toBe(1);

      const seats = await prisma.gameParticipant.findMany({ where: { gameId: game.id }, include: { transactions: true } });
      expect(seats).toHaveLength(1);
      expect(seats[0].userId).toBe(aidan.id);
      expect(num(seats[0].totalBoughtIn)).toBe(40);
      expect(num(seats[0].totalCashedOut)).toBe(60);
      expect(seats[0].transactions).toHaveLength(4); // both buy-ins and both cash-outs
      expect((await prisma.guest.findUniqueOrThrow({ where: { id: dupe.id } })).mergedIntoId).toBe(aidan.id);

      const rows = await getLeaderboardRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].sessionsPlayed).toBe(1); // one night, not two
      expect(rows[0].netProfit).toBe(20); // 60 out - 40 in
    });

    it("combines overlapping games and moves the rest over normally", async () => {
      const admin = await createAdmin();
      const aidan = await createUser();
      const dupe = await createGuest(admin, "Aiden");
      const both = await createGame({
        creator: admin,
        status: "COMPLETED",
        seats: [{ user: aidan, cashedOut: 20 }, { guest: dupe, cashedOut: 20 }],
      });
      const onlyDupe = await createGame({ creator: admin, status: "COMPLETED", seats: [{ guest: dupe, cashedOut: 30 }] });
      signInAs(admin);

      expect((await merge(dupe.id, { targetUserId: aidan.id, combineSeats: true })).status).toBe(200);
      expect(await prisma.gameParticipant.count({ where: { gameId: both.game.id } })).toBe(1);
      const moved = await prisma.gameParticipant.findFirstOrThrow({ where: { gameId: onlyDupe.game.id } });
      expect(moved.userId).toBe(aidan.id);
      expect(moved.guestId).toBeNull();
    });

    it("works for a guest merged into another guest too", async () => {
      const admin = await createAdmin();
      const keep = await createGuest(admin, "Aidan");
      const dupe = await createGuest(admin, "Aiden");
      const { game } = await createGame({
        creator: admin,
        status: "COMPLETED",
        seats: [{ guest: keep, cashedOut: 5 }, { guest: dupe, cashedOut: 45 }],
      });
      signInAs(admin);

      expect((await merge(dupe.id, { targetGuestId: keep.id, combineSeats: true })).status).toBe(200);
      const seats = await prisma.gameParticipant.findMany({ where: { gameId: game.id } });
      expect(seats).toHaveLength(1);
      expect(seats[0].guestId).toBe(keep.id);
      expect(num(seats[0].totalCashedOut)).toBe(50);
    });

    it("can combine two seats in a game that's still running (both still playing)", async () => {
      const admin = await createAdmin();
      const aidan = await createUser();
      const dupe = await createGuest(admin, "Aiden");
      const { game } = await createGame({
        creator: admin,
        seats: [{ user: aidan }, { guest: dupe, boughtIn: 20 }],
      });
      signInAs(admin);

      expect((await merge(dupe.id, { targetUserId: aidan.id, combineSeats: true })).status).toBe(200);
      const seats = await prisma.gameParticipant.findMany({ where: { gameId: game.id } });
      expect(seats).toHaveLength(1);
      expect(num(seats[0].totalBoughtIn)).toBe(40);
      expect(seats[0].totalCashedOut).toBeNull();
    });

    it("refuses even with combineSeats when one seat has cashed out and the other is still playing", async () => {
      const admin = await createAdmin();
      const aidan = await createUser();
      const dupe = await createGuest(admin, "Aiden");
      const { game } = await createGame({
        creator: admin,
        seats: [{ user: aidan, cashedOut: 10 }, { guest: dupe }],
      });
      signInAs(admin);

      const { status, body } = await read(await merge(dupe.id, { targetUserId: aidan.id, combineSeats: true }));
      expect(status).toBe(409);
      expect(body.canCombine).toBe(false);
      expect(await prisma.gameParticipant.count({ where: { gameId: game.id } })).toBe(2);
      expect((await prisma.guest.findUniqueOrThrow({ where: { id: dupe.id } })).mergedIntoId).toBeNull();
    });
  });
});
