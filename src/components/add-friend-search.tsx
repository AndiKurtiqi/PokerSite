"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchUser = {
  type: "user";
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isFriend: boolean;
};

export function AddFriendSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.others ?? []);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function addFriend(user: SearchUser) {
    setAddingId(user.id);
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId: user.id }),
    });
    setAddingId(null);
    setQuery("");
    setResults([]);
    router.refresh();
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search players to add as a friend..."
        className="w-full rounded border border-black/20 px-3 py-2 text-sm dark:border-white/20"
      />
      {query.trim().length > 0 && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded border border-black/10 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-zinc-900">
          {results.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm">{u.displayName}</span>
              <button
                type="button"
                onClick={() => addFriend(u)}
                disabled={addingId === u.id}
                className="text-xs underline disabled:opacity-40"
              >
                {addingId === u.id ? "Adding..." : "+ Add friend"}
              </button>
            </div>
          ))}
        </div>
      )}
      {query.trim().length > 0 && results.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded border border-black/10 bg-white p-2 text-sm text-black/50 shadow-lg dark:border-white/10 dark:bg-zinc-900 dark:text-white/50">
          No matching players.
        </div>
      )}
    </div>
  );
}
