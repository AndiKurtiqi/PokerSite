"use client";

import { useEffect, useRef, useState } from "react";

export type SelectedPlayer = {
  type: "user" | "guest";
  id: string;
  label: string;
};

type SearchUser = {
  type: "user";
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isFriend: boolean;
};
type SearchGuest = { type: "guest"; id: string; name: string };

type SearchResults = {
  friends: SearchUser[];
  guests: SearchGuest[];
  others: SearchUser[];
};

const EMPTY_RESULTS: SearchResults = { friends: [], guests: [], others: [] };

export function PlayerPicker({
  selected,
  onChange,
}: {
  selected: SelectedPlayer[];
  onChange: (players: SelectedPlayer[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [open, setOpen] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function isSelected(type: "user" | "guest", id: string) {
    return selected.some((p) => p.type === type && p.id === id);
  }

  function addPlayer(player: SelectedPlayer) {
    if (isSelected(player.type, player.id)) return;
    onChange([...selected, player]);
    setQuery("");
    setResults(EMPTY_RESULTS);
    setOpen(false);
  }

  function removePlayer(type: "user" | "guest", id: string) {
    onChange(selected.filter((p) => !(p.type === type && p.id === id)));
  }

  async function addAsFriendThenSelect(user: SearchUser) {
    setAddingFriendId(user.id);
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId: user.id }),
    });
    setAddingFriendId(null);
    addPlayer({ type: "user", id: user.id, label: user.displayName });
  }

  async function createGuestAndSelect() {
    const name = query.trim();
    if (name.length === 0) return;
    const res = await fetch("/api/guests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const { guest } = await res.json();
    addPlayer({ type: "guest", id: guest.id, label: `${guest.name} (guest)` });
  }

  const hasResults =
    results.friends.length > 0 || results.guests.length > 0 || results.others.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((p) => (
            <li
              key={`${p.type}-${p.id}`}
              className="flex items-center gap-2 rounded-full border border-black/20 px-3 py-1 text-sm dark:border-white/20"
            >
              {p.label}
              <button
                type="button"
                onClick={() => removePlayer(p.type, p.id)}
                className="text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
                aria-label={`Remove ${p.label}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search friends or type a name to add a guest..."
          className="w-full rounded border border-black/20 px-3 py-2 text-sm dark:border-white/20"
        />

        {open && query.trim().length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-900">
            {results.friends.length > 0 && (
              <div className="border-b border-black/10 p-2 dark:border-white/10">
                <p className="px-2 pb-1 text-xs font-medium uppercase text-black/40 dark:text-white/40">
                  Friends
                </p>
                {results.friends.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={isSelected("user", u.id)}
                    onClick={() => addPlayer({ type: "user", id: u.id, label: u.displayName })}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
                  >
                    {u.displayName}
                  </button>
                ))}
              </div>
            )}

            {results.guests.length > 0 && (
              <div className="border-b border-black/10 p-2 dark:border-white/10">
                <p className="px-2 pb-1 text-xs font-medium uppercase text-black/40 dark:text-white/40">
                  Your guests
                </p>
                {results.guests.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    disabled={isSelected("guest", g.id)}
                    onClick={() => addPlayer({ type: "guest", id: g.id, label: `${g.name} (guest)` })}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            {results.others.length > 0 && (
              <div className="border-b border-black/10 p-2 dark:border-white/10">
                <p className="px-2 pb-1 text-xs font-medium uppercase text-black/40 dark:text-white/40">
                  Other players
                </p>
                {results.others.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-2 py-1.5">
                    <button
                      type="button"
                      disabled={isSelected("user", u.id)}
                      onClick={() => addPlayer({ type: "user", id: u.id, label: u.displayName })}
                      className="text-left text-sm hover:underline disabled:opacity-40"
                    >
                      {u.displayName}
                    </button>
                    <button
                      type="button"
                      onClick={() => addAsFriendThenSelect(u)}
                      disabled={addingFriendId === u.id}
                      className="text-xs underline disabled:opacity-40"
                    >
                      {addingFriendId === u.id ? "Adding..." : "+ Add as friend"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="p-2">
              <button
                type="button"
                onClick={createGuestAndSelect}
                className="w-full rounded px-2 py-1.5 text-left text-sm text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
              >
                {hasResults ? "Not them? " : ""}Add &quot;{query.trim()}&quot; as a guest
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
