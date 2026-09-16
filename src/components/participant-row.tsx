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
}: {
  gameId: string;
  participantId: string;
  name: string;
  totalBoughtIn: number;
  totalCashedOut: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"rebuy" | "cashout" | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const net = totalCashedOut !== null ? totalCashedOut - totalBoughtIn : null;

  async function submit(type: "REBUY" | "CASH_OUT") {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Enter a positive amount.");
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

      {mode && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0.01"
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
