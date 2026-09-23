"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteGameButton({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.push("/games");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-red-600 underline"
      >
        Delete game
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <p className="max-w-xs text-right text-sm text-red-600">
        Permanently delete this game? This erases every buy-in, cash-out, and
        table assignment in it and removes it from everyone&apos;s
        leaderboard stats. This can&apos;t be undone.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded border border-black/20 px-3 py-1 text-sm dark:border-white/20"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={confirmDelete}
          className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Deleting..." : "Confirm delete"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
