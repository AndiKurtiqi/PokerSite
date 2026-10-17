"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Target = { type: "user" | "guest"; id: string; name: string };
type OtherGuest = { id: string; name: string };

/** Loose name match used to float likely duplicates ("Mike" / "Mike B.") to the top. */
function looksLikeSameName(a: string, b: string) {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x) || x.split(/\s+/)[0] === y.split(/\s+/)[0];
}

export function MergeGuestControl({
  guestId,
  guestName,
  sessions,
  otherGuests,
}: {
  guestId: string;
  guestName: string;
  sessions: number;
  otherGuests: OtherGuest[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Target[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
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
        const users: { id: string; displayName: string }[] = [
          ...(data.friends ?? []),
          ...(data.others ?? []),
        ];
        setResults(users.map((u) => ({ type: "user", id: u.id, name: u.displayName })));
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
      body: JSON.stringify(
        target.type === "user" ? { targetUserId: target.id } : { targetGuestId: target.id }
      ),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.refresh();
  }

  const q = query.trim().toLowerCase();
  const guestMatches = otherGuests
    .filter((g) => (q ? g.name.toLowerCase().includes(q) : true))
    .map((g) => ({ ...g, likely: looksLikeSameName(g.name, guestName) }))
    .sort((a, b) => Number(b.likely) - Number(a.likely) || a.name.localeCompare(b.name))
    .slice(0, 6);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary self-start px-3 py-1 text-sm"
      >
        Merge into account or guest...
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border p-3 border-line rounded-xl bg-surface">
      {!target ? (
        <>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for the real account..."
            className="px-2 py-1 text-sm input"
          />
          {guestMatches.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-subtle">
                Other guests (same person under another banker?)
              </p>
              <ul className="flex flex-col gap-1">
                {guestMatches.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setTarget({ type: "guest", id: g.id, name: g.name })}
                      className="text-sm hover:underline"
                    >
                      {g.name} <span className="text-xs text-subtle">(guest)</span>
                      {g.likely && (
                        <span className="ml-1 text-xs text-subtle">· likely match</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-subtle">Accounts</p>
              <ul className="flex flex-col gap-1">
                {results.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setTarget(u)}
                      className="text-sm hover:underline"
                    >
                      {u.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm">
            Move {sessions} completed session{sessions === 1 ? "" : "s"} from guest{" "}
            <strong>{guestName}</strong> into{" "}
            {target.type === "user" ? (
              <>
                <strong>{target.name}</strong>&apos;s account
              </>
            ) : (
              <>
                guest <strong>{target.name}</strong>
              </>
            )}
            ? This can&apos;t be undone from the UI.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={confirmMerge}
              className="px-3 py-1 text-sm disabled:opacity-50 btn-primary"
            >
              {loading ? "Merging..." : "Confirm merge"}
            </button>
            <button
              type="button"
              onClick={() => setTarget(null)}
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
        onClick={() => {
          setOpen(false);
          setTarget(null);
          setQuery("");
          setResults([]);
          setError(null);
        }}
        className="self-start text-xs underline text-subtle"
      >
        Cancel
      </button>
    </div>
  );
}
