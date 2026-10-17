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
    <div
      data-testid="participant-row"
      className="flex flex-col gap-2 border-b py-3 last:border-0 border-line"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={`font-medium ${totalCashedOut !== null ? "text-muted" : ""}`}>{name}</p>
          <p className="text-sm text-muted">
            Bought in: {formatUSD(totalBoughtIn)}
            {totalCashedOut !== null && <> · Cashed out: {formatUSD(totalCashedOut)}</>}
            {net !== null && (
              <>
                {" · "}
                <span className={net >= 0 ? "text-success" : "text-danger"}>
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
              className="px-2 py-1 text-sm disabled:opacity-50 input"
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
                className="px-3 py-1 text-sm btn-secondary"
              >
                Rebuy
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === "cashout" ? null : "cashout")}
                className="px-3 py-1 text-sm btn-primary"
              >
                Cash out
              </button>
            </div>
          )}
        </div>
      </div>

      {tableError && <p className="text-sm text-danger">{tableError}</p>}

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
            className="w-32 px-2 py-1 text-sm input"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => submit(mode === "rebuy" ? "REBUY" : "CASH_OUT")}
            className="px-3 py-1 text-sm disabled:opacity-50 btn-primary"
          >
            {loading ? "Saving..." : "Confirm"}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
