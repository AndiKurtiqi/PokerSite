"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchUser = { type: "user"; id: string; displayName: string };

export function MergeGuestControl({
  guestId,
  guestName,
  sessions,
}: {
  guestId: string;
  guestName: string;
  sessions: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [target, setTarget] = useState<SearchUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) return;
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults([...(data.friends ?? []), ...(data.others ?? [])]);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function confirmMerge() {
    if (!target) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/guests/${guestId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: target.id }),
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
        className="rounded border border-black/20 px-3 py-1 text-sm dark:border-white/20"
      >
        Merge into account...
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-black/10 p-3 dark:border-white/10">
      {!target ? (
        <>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for the real account..."
            className="rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20"
          />
          {results.length > 0 && (
            <ul className="flex flex-col gap-1">
              {results.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setTarget(u)}
                    className="text-sm hover:underline"
                  >
                    {u.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="text-sm">
            Move {sessions} completed session{sessions === 1 ? "" : "s"} from guest{" "}
            <strong>{guestName}</strong> into <strong>{target.displayName}</strong>&apos;s
            account? This can&apos;t be undone from the UI.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={confirmMerge}
              className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "Merging..." : "Confirm merge"}
            </button>
            <button
              type="button"
              onClick={() => setTarget(null)}
              className="rounded border border-black/20 px-3 py-1 text-sm dark:border-white/20"
            >
              Back
            </button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setTarget(null);
          setQuery("");
          setResults([]);
          setError(null);
        }}
        className="self-start text-xs text-black/50 underline dark:text-white/50"
      >
        Cancel
      </button>
    </div>
  );
}
