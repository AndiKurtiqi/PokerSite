"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlayerPicker, type SelectedPlayer } from "@/components/player-picker";

type ChipSet = { id: string; name: string };

export function NewGameForm({
  creatorId,
  creatorName,
}: {
  creatorId: string;
  creatorName: string;
}) {
  const router = useRouter();
  const [buyIn, setBuyIn] = useState("20");
  const [chipSets, setChipSets] = useState<ChipSet[]>([]);
  const [chipSetId, setChipSetId] = useState<string>("");
  const [players, setPlayers] = useState<SelectedPlayer[]>([
    { type: "user", id: creatorId, label: creatorName },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/chip-sets")
      .then((res) => res.json())
      .then((data) => {
        setChipSets(data.chipSets ?? []);
        if (data.chipSets?.length > 0) setChipSetId(data.chipSets[0].id);
      });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (players.length === 0) {
      setError("Add at least one player.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyInAmount: Number(buyIn),
        chipSetId: chipSetId || null,
        players: players.map((p) => ({ type: p.type, id: p.id })),
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    const { game } = await res.json();
    router.push(`/games/${game.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1 text-sm">
        Buy-in amount ($)
        <input
          type="number"
          step="0.01"
          min="0.01"
          required
          value={buyIn}
          onChange={(e) => setBuyIn(e.target.value)}
          className="px-3 py-2 input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Chip set
        {chipSets.length === 0 ? (
          <p className="text-muted">
            No chip sets yet.{" "}
            <Link href="/chip-sets/new" className="underline">
              Create one
            </Link>{" "}
            to get a chip breakdown for this game (optional).
          </p>
        ) : (
          <select
            value={chipSetId}
            onChange={(e) => setChipSetId(e.target.value)}
            className="px-3 py-2 input"
          >
            {chipSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
        )}
      </label>

      <div className="flex flex-col gap-1 text-sm">
        Players
        <PlayerPicker selected={players} onChange={setPlayers} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="self-start px-4 py-2 text-sm disabled:opacity-50 btn-primary"
      >
        {loading ? "Creating..." : "Create game"}
      </button>
    </form>
  );
}
