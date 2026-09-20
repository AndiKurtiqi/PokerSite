"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinGameButton({
  gameId,
  defaultAmount,
}: {
  gameId: string;
  defaultAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function join() {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/games/${gameId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: value }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
      >
        Join game
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min="0.01"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20"
        />
        <button
          type="button"
          disabled={loading}
          onClick={join}
          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Joining..." : "Confirm"}
        </button>
      </div>
      {error && <p className="max-w-xs text-right text-sm text-red-600">{error}</p>}
    </div>
  );
}
