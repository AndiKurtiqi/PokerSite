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
                ? "btn-primary rounded-full px-3.5 py-1.5 text-sm"
                : "btn-secondary rounded-full px-3.5 py-1.5 text-sm"
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
      <table className="tabular w-full min-w-[34rem] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wider text-subtle">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Player</th>
            <th className="px-4 py-3 font-medium">Net profit</th>
            <th className="px-4 py-3 font-medium">ROI %</th>
            <th className="px-4 py-3 font-medium">Avg / session</th>
            <th className="px-4 py-3 font-medium">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.key} className="border-b border-line last:border-0 hover:bg-white/[0.03]">
              <td className={`px-4 py-3 font-semibold ${i < 3 ? "text-accent" : "text-subtle"}`}>{i + 1}</td>
              <td className="px-4 py-3 font-medium">
                {row.displayName}
                {row.isGuest && (
                  <span className="ml-1 text-xs text-subtle">(guest)</span>
                )}
                {row.streak.type === "hot" && (
                  <span className="ml-2 text-xs text-orange-400">
                    🔥 {row.streak.length}
                  </span>
                )}
                {row.streak.type === "cold" && (
                  <span className="ml-2 text-xs text-sky-400">
                    ❄️ {row.streak.length}
                  </span>
                )}
              </td>
              <td
                className={
                  row.netProfit >= 0
                    ? "px-4 py-3 font-medium text-success"
                    : "px-4 py-3 font-medium text-danger"
                }
              >
                {row.netProfit >= 0 ? "+" : ""}
                {formatUSD(row.netProfit)}
              </td>
              <td className="px-4 py-3 text-muted">{row.roiPercent.toFixed(1)}%</td>
              <td className="px-4 py-3 text-muted">{formatUSD(row.avgPerSession)}</td>
              <td className="px-4 py-3 text-muted">{row.sessionsPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
