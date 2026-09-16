"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlayerPicker, type SelectedPlayer } from "@/components/player-picker";

type ChipSet = { id: string; name: string };

export default function NewGamePage() {
  const router = useRouter();
  const [buyIn, setBuyIn] = useState("20");
  const [chipSets, setChipSets] = useState<ChipSet[]>([]);
  const [chipSetId, setChipSetId] = useState<string>("");
  const [players, setPlayers] = useState<SelectedPlayer[]>([]);
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">New game</h1>
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
            className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Chip set
          {chipSets.length === 0 ? (
            <p className="text-black/60 dark:text-white/60">
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
              className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="self-start rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Creating..." : "Create game"}
        </button>
      </form>
    </div>
  );
}
