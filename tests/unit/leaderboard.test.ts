import { describe, expect, it } from "vitest";
import { computeLeaderboard, type SessionResult } from "@/lib/leaderboard";

/** Builds a session result; `day` orders sessions chronologically. */
function session(
  key: string,
  boughtIn: number,
  cashedOut: number,
  day: number,
  opts: { name?: string; isGuest?: boolean } = {}
): SessionResult {
  return {
    key,
    displayName: opts.name ?? key,
    isGuest: opts.isGuest ?? false,
    boughtIn,
    cashedOut,
    endedAt: new Date(2026, 0, day),
  };
}

const row = (rows: ReturnType<typeof computeLeaderboard>, key: string) => {
  const found = rows.find((r) => r.key === key);
  if (!found) throw new Error(`no row for ${key}`);
  return found;
};

describe("computeLeaderboard — totals", () => {
  it("aggregates sessions per player", () => {
    const rows = computeLeaderboard([
      session("a", 20, 50, 1),
      session("a", 20, 5, 2),
      session("b", 20, 20, 1),
    ]);
    const a = row(rows, "a");
    expect(a.sessionsPlayed).toBe(2);
    expect(a.totalBoughtIn).toBe(40);
    expect(a.totalCashedOut).toBe(55);
    expect(a.netProfit).toBe(15);
    expect(a.avgPerSession).toBe(7.5);
    expect(rows).toHaveLength(2);
  });

  it("computes ROI as net profit over total bought in", () => {
    const rows = computeLeaderboard([session("a", 20, 30, 1), session("a", 20, 10, 2)]);
    // net 0 over 40 in
    expect(row(rows, "a").roiPercent).toBe(0);
    const winner = computeLeaderboard([session("w", 40, 60, 1)]);
    expect(row(winner, "w").roiPercent).toBe(50);
  });

  it("reports 0% ROI instead of dividing by zero", () => {
    const rows = computeLeaderboard([session("a", 0, 0, 1)]);
    expect(row(rows, "a").roiPercent).toBe(0);
  });

  it("keeps the guest flag and display name", () => {
    const rows = computeLeaderboard([
      session("guest:1", 20, 25, 1, { name: "Mike", isGuest: true }),
      session("user:1", 20, 25, 1, { name: "Andi" }),
    ]);
    expect(row(rows, "guest:1").isGuest).toBe(true);
    expect(row(rows, "guest:1").displayName).toBe("Mike");
    expect(row(rows, "user:1").isGuest).toBe(false);
  });

  it("returns nothing for no sessions", () => {
    expect(computeLeaderboard([])).toEqual([]);
  });
});

describe("computeLeaderboard — hot/cold streaks", () => {
  it("flags a hot streak after 2+ consecutive winning sessions", () => {
    const rows = computeLeaderboard([
      session("a", 20, 30, 1),
      session("a", 20, 40, 2),
      session("a", 20, 21, 3),
    ]);
    expect(row(rows, "a").streak).toEqual({ type: "hot", length: 3 });
  });

  it("flags a cold streak after 2+ consecutive losing sessions", () => {
    const rows = computeLeaderboard([session("a", 20, 10, 1), session("a", 20, 0, 2)]);
    expect(row(rows, "a").streak).toEqual({ type: "cold", length: 2 });
  });

  it("does not flag a single win or loss", () => {
    expect(row(computeLeaderboard([session("a", 20, 30, 1)]), "a").streak.type).toBe("none");
    expect(row(computeLeaderboard([session("a", 20, 5, 1)]), "a").streak.type).toBe("none");
  });

  it("only counts the trailing run (a win after losses is not a streak)", () => {
    const rows = computeLeaderboard([
      session("a", 20, 5, 1),
      session("a", 20, 5, 2),
      session("a", 20, 30, 3),
    ]);
    expect(row(rows, "a").streak.type).toBe("none");
  });

  it("counts only the latest run when earlier results differ", () => {
    const rows = computeLeaderboard([
      session("a", 20, 5, 1),
      session("a", 20, 30, 2),
      session("a", 20, 30, 3),
    ]);
    expect(row(rows, "a").streak).toEqual({ type: "hot", length: 2 });
  });

  it("treats a break-even last session as no streak", () => {
    const rows = computeLeaderboard([
      session("a", 20, 30, 1),
      session("a", 20, 30, 2),
      session("a", 20, 20, 3),
    ]);
    expect(row(rows, "a").streak.type).toBe("none");
  });

  it("orders sessions chronologically even if input is shuffled", () => {
    const rows = computeLeaderboard([
      session("a", 20, 30, 3),
      session("a", 20, 5, 1),
      session("a", 20, 30, 2),
    ]);
    expect(row(rows, "a").streak).toEqual({ type: "hot", length: 2 });
  });
});
