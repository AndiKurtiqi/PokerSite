"use client";

import { useState } from "react";
import { formatUSD } from "@/lib/money";
import type { LeaderboardRow } from "@/lib/leaderboard";

type SortKey = "netProfit" | "roiPercent" | "avgPerSession" | "sessionsPlayed";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "netProfit", label: "Net profit" },
  { key: "roiPercent", label: "ROI %" },
  { key: "avgPerSession", label: "Avg / session" },
  { key: "sessionsPlayed", label: "Sessions played" },
];

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("netProfit");

  const sorted = [...rows].sort((a, b) => b[sortKey] - a[sortKey]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSortKey(opt.key)}
            className={
              sortKey === opt.key
                ? "rounded-full bg-black px-3 py-1 text-sm text-white dark:bg-white dark:text-black"
                : "rounded-full border border-black/20 px-3 py-1 text-sm dark:border-white/20"
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10">
            <th className="py-2 font-medium">#</th>
            <th className="py-2 font-medium">Player</th>
            <th className="py-2 font-medium">Net profit</th>
            <th className="py-2 font-medium">ROI %</th>
            <th className="py-2 font-medium">Avg / session</th>
            <th className="py-2 font-medium">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.key} className="border-b border-black/10 dark:border-white/10">
              <td className="py-2 text-black/50 dark:text-white/50">{i + 1}</td>
              <td className="py-2">
                {row.displayName}
                {row.isGuest && (
                  <span className="ml-1 text-xs text-black/40 dark:text-white/40">(guest)</span>
                )}
                {row.streak.type === "hot" && (
                  <span className="ml-2 text-xs text-orange-500">
                    🔥 {row.streak.length}
                  </span>
                )}
                {row.streak.type === "cold" && (
                  <span className="ml-2 text-xs text-blue-500">
                    ❄️ {row.streak.length}
                  </span>
                )}
              </td>
              <td
                className={
                  row.netProfit >= 0
                    ? "py-2 text-green-600"
                    : "py-2 text-red-600"
                }
              >
                {row.netProfit >= 0 ? "+" : ""}
                {formatUSD(row.netProfit)}
              </td>
              <td className="py-2">{row.roiPercent.toFixed(1)}%</td>
              <td className="py-2">{formatUSD(row.avgPerSession)}</td>
              <td className="py-2">{row.sessionsPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
