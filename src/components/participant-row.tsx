"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUSD } from "@/lib/money";

export function ParticipantRow({
  gameId,
  participantId,
  name,
  totalBoughtIn,
  totalCashedOut,
  canEdit,
  tableNumber,
  tableOptions,
  canManageTables,
}: {
  gameId: string;
  participantId: string;
  name: string;
  totalBoughtIn: number;
  totalCashedOut: number | null;
  canEdit: boolean;
  tableNumber?: number;
  tableOptions?: number[];
  canManageTables?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"rebuy" | "cashout" | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [movingTable, setMovingTable] = useState(false);

  async function moveTable(newTable: number) {
    setMovingTable(true);
    setTableError(null);
    const res = await fetch(
      `/api/games/${gameId}/participants/${participantId}/table`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber: newTable }),
      }
    );
    setMovingTable(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setTableError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  const net = totalCashedOut !== null ? totalCashedOut - totalBoughtIn : null;

  async function submit(type: "REBUY" | "CASH_OUT") {
    if (amount.trim() === "") {
      setError("Enter an amount.");
      return;
    }
    const value = Number(amount);
    if (Number.isNaN(value) || value < 0 || (type === "REBUY" && value === 0)) {
      setError(type === "REBUY" ? "Enter a positive amount." : "Enter an amount of 0 or more.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/games/${gameId}/participants/${participantId}/transactions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: value }),
      }
    );
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setMode(null);
    setAmount("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 border-b border-black/10 py-3 last:border-0 dark:border-white/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-black/60 dark:text-white/60">
            Bought in: {formatUSD(totalBoughtIn)}
            {totalCashedOut !== null && <> · Cashed out: {formatUSD(totalCashedOut)}</>}
            {net !== null && (
              <>
                {" · "}
                <span className={net >= 0 ? "text-green-600" : "text-red-600"}>
                  {net >= 0 ? "+" : ""}
                  {formatUSD(net)}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageTables && tableNumber !== undefined && tableOptions && (
            <select
              value={tableNumber}
              disabled={movingTable}
              onChange={(e) => moveTable(Number(e.target.value))}
              className="rounded border border-black/20 px-2 py-1 text-sm disabled:opacity-50 dark:border-white/20 dark:bg-zinc-900"
            >
              {tableOptions.map((t) => (
                <option key={t} value={t}>
                  Table {t}
                </option>
              ))}
            </select>
          )}

          {canEdit && totalCashedOut === null && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode(mode === "rebuy" ? null : "rebuy")}
                className="rounded border border-black/20 px-3 py-1 text-sm dark:border-white/20"
              >
                Rebuy
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === "cashout" ? null : "cashout")}
                className="rounded bg-black px-3 py-1 text-sm text-white dark:bg-white dark:text-black"
              >
                Cash out
              </button>
            </div>
          )}
        </div>
      </div>

      {tableError && <p className="text-sm text-red-600">{tableError}</p>}

      {mode && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min={mode === "rebuy" ? "0.01" : "0"}
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount ($)"
            className="w-32 rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => submit(mode === "rebuy" ? "REBUY" : "CASH_OUT")}
            className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "Saving..." : "Confirm"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
