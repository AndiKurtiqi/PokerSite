"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";

export type Suggestion = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  reason: string | null;
};

export function SuggestedFriends({
  suggestions,
  totalRemaining,
}: {
  suggestions: Suggestion[];
  totalRemaining: number;
}) {
  const router = useRouter();
  const [addingId, setAddingId] = useState<string | null>(null);

  async function addFriend(id: string) {
    setAddingId(id);
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId: id }),
    });
    setAddingId(null);
    // The refreshed page drops this person and fills the list with the next suggestion.
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Suggested friends">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Suggested</h2>
        {totalRemaining > suggestions.length && (
          <span className="text-xs text-subtle">
            {totalRemaining - suggestions.length} more after these
          </span>
        )}
      </div>
      <ul className="flex flex-col divide-y border border-line rounded-xl bg-surface divide-line">
        {suggestions.map((s) => (
          <li key={s.id} data-testid="suggestion-row" className="flex items-center gap-3 p-3">
            <Avatar name={s.displayName} avatarUrl={s.avatarUrl} />
            <div className="flex flex-1 flex-col">
              <span className="font-medium">{s.displayName}</span>
              {s.reason && (
                <span className="text-sm text-muted">{s.reason}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => addFriend(s.id)}
              disabled={addingId === s.id}
              className="px-3 py-1 text-sm disabled:opacity-40 btn-secondary"
            >
              {addingId === s.id ? "Adding..." : "+ Add friend"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
