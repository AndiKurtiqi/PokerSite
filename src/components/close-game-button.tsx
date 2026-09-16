"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CloseGameButton({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClose() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/games/${gameId}/close`, { method: "POST" });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClose}
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {loading ? "Closing..." : "Close game"}
      </button>
      {error && <p className="max-w-xs text-right text-sm text-red-600">{error}</p>}
    </div>
  );
}
