import { describe, expect, it } from "vitest";
import { computeLeaderboard, rankLeaderboard, sortLeaderboard, type SessionResult } from "@/lib/leaderboard";

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

describe("rankLeaderboard", () => {
  const board = (...sessions: SessionResult[]) => computeLeaderboard(sessions);

  it("sorts best-first by the chosen column and numbers the rows", () => {
    const rows = rankLeaderboard(
      board(session("a", 20, 25, 1), session("b", 20, 60, 1), session("c", 20, 10, 1))
    );
    expect(rows.map((r) => [r.key, r.rank])).toEqual([["b", 1], ["a", 2], ["c", 3]]);
  });

  it("doesn't depend on the order the rows came in (the dashboard-vs-table bug)", () => {
    const sessions = [session("loser", 20, 0, 1), session("winner", 20, 90, 1), session("mid", 20, 30, 1)];
    const forwards = rankLeaderboard(computeLeaderboard(sessions));
    const backwards = rankLeaderboard(computeLeaderboard([...sessions].reverse()));
    expect(backwards.map((r) => r.key)).toEqual(forwards.map((r) => r.key));
    expect(forwards.find((r) => r.key === "mid")!.rank).toBe(2);
  });

  it("gives players who are level the same rank, and skips the next number", () => {
    const rows = rankLeaderboard(
      board(session("a", 20, 60, 1), session("b", 20, 20, 1), session("c", 20, 20, 1), session("d", 20, 0, 1))
    );
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
    expect(rows.map((r) => r.tied)).toEqual([false, true, true, false]);
  });

  it("breaks ties the same way every time: by net profit, then sessions, then name", () => {
    // Same ROI (50%) but different money, then same net with different session counts.
    const rows = rankLeaderboard(
      board(
        session("small", 20, 30, 1, { name: "Small" }), // +10, 50%
        session("big", 40, 60, 1, { name: "Big" }), // +20, 50%
        session("zed", 20, 20, 1, { name: "Zed" }),
        session("amy", 20, 20, 1, { name: "Amy" })
      ),
      "roiPercent"
    );
    expect(rows.map((r) => r.key)).toEqual(["big", "small", "amy", "zed"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3, 3]);
  });

  it("treats values that display the same as level, not split by rounding noise", () => {
    const rows = rankLeaderboard(
      board(session("a", 20, 20.004, 1), session("b", 20, 19.996, 1), session("c", 20, 25, 1))
    );
    expect(rows.find((r) => r.key === "a")!.rank).toBe(rows.find((r) => r.key === "b")!.rank);
  });

  it("ranks by each of the sort columns", () => {
    const sessions = [
      session("grinder", 20, 24, 1),
      session("grinder", 20, 24, 2),
      session("grinder", 20, 24, 3), // +12 over 3 sessions
      session("shark", 20, 80, 1), // +60 in 1 session
    ];
    const rows = computeLeaderboard(sessions);
    expect(rankLeaderboard(rows, "netProfit")[0].key).toBe("shark");
    expect(rankLeaderboard(rows, "avgPerSession")[0].key).toBe("shark");
    expect(rankLeaderboard(rows, "sessionsPlayed")[0].key).toBe("grinder");
  });

  it("handles an empty leaderboard", () => {
    expect(rankLeaderboard([])).toEqual([]);
  });
});

describe("sortLeaderboard (direction)", () => {
  const rows = computeLeaderboard([
    session("often", 20, 20, 1),
    session("often", 20, 20, 2),
    session("often", 20, 20, 3),
    session("some", 20, 20, 1),
    session("some", 20, 20, 2),
    session("once", 20, 20, 1),
  ]);

  it("lists the most first by default", () => {
    expect(sortLeaderboard(rows, "sessionsPlayed").map((r) => r.key)).toEqual(["often", "some", "once"]);
  });

  it("lists the fewest first when ascending, with ranks counting down", () => {
    const asc = sortLeaderboard(rows, "sessionsPlayed", "asc");
    expect(asc.map((r) => r.key)).toEqual(["once", "some", "often"]);
    expect(asc.map((r) => r.rank)).toEqual([3, 2, 1]);
  });

  it("ascending is exactly the reverse of descending", () => {
    for (const key of ["netProfit", "roiPercent", "avgPerSession", "sessionsPlayed"] as const) {
      const desc = sortLeaderboard(rows, key, "desc").map((r) => r.key);
      const asc = sortLeaderboard(rows, key, "asc").map((r) => r.key);
      expect(asc).toEqual([...desc].reverse());
    }
  });
});
