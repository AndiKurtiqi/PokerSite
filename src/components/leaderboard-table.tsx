"use client";

import { useState } from "react";
import { formatUSD } from "@/lib/money";
import {
  sortLeaderboard,
  type LeaderboardRow,
  type SortDirection,
  type SortKey,
} from "@/lib/leaderboard";

const COLUMNS: { key: SortKey; label: string; pill: string }[] = [
  { key: "netProfit", label: "Net profit", pill: "Net profit" },
  { key: "roiPercent", label: "ROI %", pill: "ROI %" },
  { key: "avgPerSession", label: "Avg / session", pill: "Avg / session" },
  { key: "sessionsPlayed", label: "Sessions", pill: "Sessions played" },
];

const DEFAULT_SORT = { key: "netProfit" as SortKey, direction: "desc" as SortDirection };

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  const [sort, setSort] = useState(DEFAULT_SORT);

  // First click on a column ranks it best-first; clicking it again flips the order.
  function chooseColumn(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key, direction: "desc" }
    );
  }

  const sorted = sortLeaderboard(rows, sort.key, sort.direction);
  const arrow = (key: SortKey) =>
    sort.key === key ? (
      <span aria-hidden className="ml-1 text-accent">
        {sort.direction === "desc" ? "▼" : "▲"}
      </span>
    ) : null;
  const ariaSort = (key: SortKey) =>
    sort.key === key ? (sort.direction === "desc" ? "descending" : "ascending") : "none";

  return (
    <div className="flex flex-col gap-4">
      <div data-testid="sort-pills" className="flex flex-wrap gap-2">
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            type="button"
            onClick={() => chooseColumn(col.key)}
            className={
              sort.key === col.key
                ? "btn-primary rounded-full px-3.5 py-1.5 text-sm"
                : "btn-secondary rounded-full px-3.5 py-1.5 text-sm"
            }
          >
            {col.pill}
            {sort.key === col.key && (
              <span aria-hidden className="text-xs">
                {sort.direction === "desc" ? "▼" : "▲"}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="tabular w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-subtle">
              <th className="px-4 py-3 font-medium">
                <button
                  type="button"
                  onClick={() => setSort(DEFAULT_SORT)}
                  title="Reset to the default ranking"
                  aria-label="Reset to the default ranking"
                  className="uppercase tracking-wider transition-colors hover:text-foreground"
                >
                  #
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Player</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  aria-sort={ariaSort(col.key)}
                  className="px-4 py-3 font-medium"
                >
                  <button
                    type="button"
                    onClick={() => chooseColumn(col.key)}
                    className={`uppercase tracking-wider transition-colors hover:text-foreground ${
                      sort.key === col.key ? "text-foreground" : ""
                    }`}
                  >
                    {col.label}
                    {arrow(col.key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.key} className="border-b border-line last:border-0 hover:bg-white/[0.03]">
                <td
                  title={row.tied ? "Tied" : undefined}
                  className={`px-4 py-3 font-semibold ${row.rank <= 3 ? "text-accent" : "text-subtle"}`}
                >
                  {row.rank}
                </td>
                <td className="px-4 py-3 font-medium">
                  {row.displayName}
                  {row.isGuest && <span className="ml-1 text-xs text-subtle">(guest)</span>}
                  {row.streak.type === "hot" && (
                    <span className="ml-2 text-xs text-orange-400">🔥 {row.streak.length}</span>
                  )}
                  {row.streak.type === "cold" && (
                    <span className="ml-2 text-xs text-sky-400">❄️ {row.streak.length}</span>
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
