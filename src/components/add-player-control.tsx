"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchUser = { type: "user"; id: string; displayName: string };
type SearchGuest = { type: "guest"; id: string; name: string };
type Picked = { type: "user" | "guest"; id: string; label: string };

type SearchResults = { friends: SearchUser[]; guests: SearchGuest[]; others: SearchUser[] };
const EMPTY_RESULTS: SearchResults = { friends: [], guests: [], others: [] };

export function AddPlayerControl({
  gameId,
  defaultAmount,
}: {
  gameId: string;
  defaultAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [amount, setAmount] = useState(String(defaultAmount));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) return;
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function createGuestAndPick() {
    const name = query.trim();
    if (name.length === 0) return;
    const res = await fetch("/api/guests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const { guest } = await res.json();
    setPicked({ type: "guest", id: guest.id, label: guest.name });
  }

  async function confirmAdd() {
    if (!picked) return;
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/games/${gameId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: picked.type, id: picked.id, amount: value }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    reset();
    router.refresh();
  }

  function reset() {
    setOpen(false);
    setQuery("");
    setResults(EMPTY_RESULTS);
    setPicked(null);
    setAmount(String(defaultAmount));
    setError(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1 text-sm btn-secondary"
      >
        + Add player
      </button>
    );
  }

  const hasResults =
    results.friends.length > 0 || results.guests.length > 0 || results.others.length > 0;

  return (
    <div className="flex flex-col gap-2 border p-3 border-line rounded-xl bg-surface">
      {!picked ? (
        <>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends or type a name to add a guest..."
            className="px-2 py-1 text-sm input"
          />
          {query.trim().length > 0 && (
            <div className="flex flex-col gap-2">
              {results.friends.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase text-subtle">
                    Friends
                  </p>
                  {results.friends.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setPicked({ type: "user", id: u.id, label: u.displayName })
                      }
                      className="block w-full rounded px-1 py-1 text-left text-sm hover:bg-white/5"
                    >
                      {u.displayName}
                    </button>
                  ))}
                </div>
              )}
              {results.guests.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase text-subtle">
                    Your guests
                  </p>
                  {results.guests.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setPicked({ type: "guest", id: g.id, label: g.name })}
                      className="block w-full rounded px-1 py-1 text-left text-sm hover:bg-white/5"
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
              {results.others.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase text-subtle">
                    Other players
                  </p>
                  {results.others.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setPicked({ type: "user", id: u.id, label: u.displayName })
                      }
                      className="block w-full rounded px-1 py-1 text-left text-sm hover:bg-white/5"
                    >
                      {u.displayName}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={createGuestAndPick}
                className="rounded px-1 py-1 text-left text-sm text-muted hover:bg-white/5"
              >
                {hasResults ? "Not them? " : ""}Add &quot;{query.trim()}&quot; as a guest
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm">
            Add <strong>{picked.label}</strong> for:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-28 px-2 py-1 text-sm input"
            />
            <button
              type="button"
              disabled={loading}
              onClick={confirmAdd}
              className="px-3 py-1 text-sm disabled:opacity-50 btn-primary"
            >
              {loading ? "Adding..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="px-3 py-1 text-sm btn-secondary"
            >
              Back
            </button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={reset}
        className="self-start text-xs underline text-subtle"
      >
        Cancel
      </button>
    </div>
  );
}
