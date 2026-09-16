import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatUSD, centsToDollars } from "@/lib/money";
import { ParticipantRow } from "@/components/participant-row";
import { CloseGameButton } from "@/components/close-game-button";
import type { ChipPlan } from "@/lib/chip-plan";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      participants: {
        include: { user: true, guest: true },
        orderBy: { joinedAt: "asc" },
      },
      chipSet: { include: { denominations: { orderBy: { value: "asc" } } } },
    },
  });

  if (!game) notFound();
  if (game.creatorId !== session!.user.id) redirect("/games");

  const chipPlan = game.chipPlan as unknown as ChipPlan | null;

  const totalBoughtIn = game.participants.reduce((sum, p) => sum + Number(p.totalBoughtIn), 0);
  const cashedOutParticipants = game.participants.filter((p) => p.totalCashedOut !== null);
  const totalCashedOut = cashedOutParticipants.reduce((sum, p) => sum + Number(p.totalCashedOut), 0);
  const allCashedOut = cashedOutParticipants.length === game.participants.length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/games" className="text-sm underline">
            ← All games
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {formatUSD(Number(game.buyInAmount))} buy-in
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            {game.status === "ACTIVE" ? "In progress" : "Completed"} · started{" "}
            {game.startedAt.toLocaleString()}
          </p>
        </div>
        {game.status === "ACTIVE" && <CloseGameButton gameId={game.id} />}
      </div>

      {chipPlan && chipPlan.perPlayer.length > 0 && (
        <div className="rounded border border-black/10 p-4 dark:border-white/10">
          <h2 className="font-medium">Chip plan (per player)</h2>
          <ul className="mt-2 flex flex-wrap gap-3 text-sm text-black/60 dark:text-white/60">
            {chipPlan.perPlayer.map((line) => (
              <li key={line.valueCents}>
                {formatUSD(centsToDollars(line.valueCents))} × {line.countPerPlayer}
              </li>
            ))}
          </ul>
          {chipPlan.warnings.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-600">
              {chipPlan.warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded border border-black/10 dark:border-white/10">
        {game.participants.map((p) => (
          <div key={p.id} className="px-4">
            <ParticipantRow
              gameId={game.id}
              participantId={p.id}
              name={p.user?.displayName ?? p.guest?.name ?? "Unknown"}
              totalBoughtIn={Number(p.totalBoughtIn)}
              totalCashedOut={p.totalCashedOut !== null ? Number(p.totalCashedOut) : null}
              canEdit={game.status === "ACTIVE"}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-between text-sm text-black/60 dark:text-white/60">
        <span>Total bought in: {formatUSD(totalBoughtIn)}</span>
        <span>
          Total cashed out: {formatUSD(totalCashedOut)}
          {!allCashedOut && ` (${cashedOutParticipants.length}/${game.participants.length} so far)`}
        </span>
      </div>
    </div>
  );
}
