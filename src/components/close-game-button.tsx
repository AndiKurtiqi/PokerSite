"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUSD } from "@/lib/money";

type Participant = {
  id: string;
  name: string;
  totalBoughtIn: number;
  totalCashedOut: number | null;
};

function initialAmounts(participants: Participant[]) {
  return Object.fromEntries(
    participants.map((p) => [p.id, p.totalCashedOut !== null ? String(p.totalCashedOut) : ""])
  );
}

export function CloseGameButton({
  gameId,
  participants,
}: {
  gameId: string;
  participants: Participant[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    initialAmounts(participants)
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalBoughtIn = participants.reduce((sum, p) => sum + p.totalBoughtIn, 0);
  const parsedAmounts = participants.map((p) => {
    const raw = amounts[p.id]?.trim() ?? "";
    const value = raw === "" ? null : Number(raw);
    return { id: p.id, value: value !== null && !Number.isNaN(value) ? value : null };
  });
  const allFilled = parsedAmounts.every((a) => a.value !== null && a.value >= 0);
  const totalCashedOut = parsedAmounts.reduce((sum, a) => sum + (a.value ?? 0), 0);
  const diff = Math.round((totalCashedOut - totalBoughtIn) * 100) / 100;

  function openModal() {
    setAmounts(initialAmounts(participants));
    setError(null);
    setOpen(true);
  }

  async function confirmClose() {
    if (!allFilled) {
      setError("Enter a cash-out amount for everyone.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/games/${gameId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cashouts: parsedAmounts.map((a) => ({ participantId: a.id, amount: a.value })),
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
      >
        Close game
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded bg-white p-6 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Close out everyone</h2>

            <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
              {participants.map((p) => (
                <label key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {p.name}{" "}
                    <span className="text-black/50 dark:text-white/50">
                      (bought in {formatUSD(p.totalBoughtIn)})
                    </span>
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus={participants[0]?.id === p.id}
                    value={amounts[p.id] ?? ""}
                    onChange={(e) =>
                      setAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    placeholder="Amount ($)"
                    className="w-28 rounded border border-black/20 px-2 py-1 dark:border-white/20"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-black/10 pt-3 text-sm dark:border-white/10">
              <span>Bought in: {formatUSD(totalBoughtIn)}</span>
              <span>
                Cashed out: {formatUSD(totalCashedOut)}
                {allFilled && diff !== 0 && (
                  <span className="text-amber-600">
                    {" "}
                    ({diff > 0 ? "+" : ""}
                    {formatUSD(diff)})
                  </span>
                )}
              </span>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || !allFilled}
                onClick={confirmClose}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {loading ? "Closing..." : "Confirm & close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
