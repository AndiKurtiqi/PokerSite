export type SessionResult = {
  key: string;
  displayName: string;
  isGuest: boolean;
  boughtIn: number;
  cashedOut: number;
  endedAt: Date;
};

export type LeaderboardRow = {
  key: string;
  displayName: string;
  isGuest: boolean;
  sessionsPlayed: number;
  totalBoughtIn: number;
  totalCashedOut: number;
  netProfit: number;
  roiPercent: number;
  avgPerSession: number;
  streak: { type: "hot" | "cold" | "none"; length: number };
};

export function computeLeaderboard(sessions: SessionResult[]): LeaderboardRow[] {
  const byKey = new Map<string, SessionResult[]>();
  for (const s of sessions) {
    const list = byKey.get(s.key) ?? [];
    list.push(s);
    byKey.set(s.key, list);
  }

  const rows: LeaderboardRow[] = [];

  for (const [key, list] of byKey) {
    list.sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime());

    const totalBoughtIn = list.reduce((sum, s) => sum + s.boughtIn, 0);
    const totalCashedOut = list.reduce((sum, s) => sum + s.cashedOut, 0);
    const netProfit = totalCashedOut - totalBoughtIn;

    let streakType: "hot" | "cold" | "none" = "none";
    let streakLength = 0;

    for (let i = list.length - 1; i >= 0; i--) {
      const net = list[i].cashedOut - list[i].boughtIn;
      const sign: "win" | "loss" | "even" = net > 0 ? "win" : net < 0 ? "loss" : "even";

      if (i === list.length - 1) {
        if (sign === "even") break;
        streakType = sign === "win" ? "hot" : "cold";
        streakLength = 1;
        continue;
      }

      const expected = streakType === "hot" ? "win" : "loss";
      if (sign === expected) {
        streakLength++;
      } else {
        break;
      }
    }

    if (streakLength < 2) {
      streakType = "none";
      streakLength = 0;
    }

    rows.push({
      key,
      displayName: list[0].displayName,
      isGuest: list[0].isGuest,
      sessionsPlayed: list.length,
      totalBoughtIn,
      totalCashedOut,
      netProfit,
      roiPercent: totalBoughtIn > 0 ? (netProfit / totalBoughtIn) * 100 : 0,
      avgPerSession: netProfit / list.length,
      streak: { type: streakType, length: streakLength },
    });
  }

  return rows;
}

export type SortKey = "netProfit" | "roiPercent" | "avgPerSession" | "sessionsPlayed";

export type RankedRow = LeaderboardRow & {
  /** Competition ranking: players level on the sorted value share a rank (1, 2, 2, 4). */
  rank: number;
  tied: boolean;
};

// Values are compared the way they're displayed, so two players who both show
// "+$0.00" or "38.1%" are level rather than split by a rounding crumb.
const PRECISION: Record<SortKey, number> = {
  netProfit: 100,
  avgPerSession: 100,
  roiPercent: 10,
  sessionsPlayed: 1,
};
const level = (row: LeaderboardRow, key: SortKey) =>
  Math.round(row[key] * PRECISION[key]) / PRECISION[key] + 0; // + 0 turns -0 into 0

/**
 * Sorts best-first by the chosen column and assigns ranks. Ties are broken the
 * same way every time (then net profit, more sessions, then name) so the order
 * never depends on how the database happened to return the rows.
 */
export function rankLeaderboard(rows: LeaderboardRow[], key: SortKey = "netProfit"): RankedRow[] {
  const sorted = [...rows].sort(
    (a, b) =>
      level(b, key) - level(a, key) ||
      b.netProfit - a.netProfit ||
      b.sessionsPlayed - a.sessionsPlayed ||
      a.displayName.localeCompare(b.displayName)
  );

  const ranked: RankedRow[] = [];
  sorted.forEach((row, i) => {
    const prev = ranked[i - 1];
    const sameAsPrev = prev !== undefined && level(prev, key) === level(row, key);
    ranked.push({ ...row, rank: sameAsPrev ? prev.rank : i + 1, tied: false });
  });
  for (const row of ranked) {
    row.tied = ranked.filter((r) => r.rank === row.rank).length > 1;
  }
  return ranked;
}

export type SortDirection = "desc" | "asc";

/**
 * Rows ordered by a column, best first ("desc") or worst first ("asc"). Ranks
 * always describe how good the value is, so a worst-first list simply counts
 * down (… 3, 2, 1) rather than renumbering.
 */
export function sortLeaderboard(
  rows: LeaderboardRow[],
  key: SortKey = "netProfit",
  direction: SortDirection = "desc"
): RankedRow[] {
  const ranked = rankLeaderboard(rows, key);
  return direction === "desc" ? ranked : ranked.reverse();
}
