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
