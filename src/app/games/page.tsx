import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatUSD } from "@/lib/money";

export default async function GamesPage() {
  const session = await auth();

  const games = await prisma.game.findMany({
    where: { creatorId: session!.user.id },
    include: { participants: true },
    orderBy: { startedAt: "desc" },
  });

  const active = games.filter((g) => g.status === "ACTIVE");
  const completed = games.filter((g) => g.status === "COMPLETED");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Games</h1>
        <Link
          href="/games/new"
          className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          New game
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase text-black/50 dark:text-white/50">
          Active
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No active games.</p>
        ) : (
          active.map((g) => (
            <Link
              key={g.id}
              href={`/games/${g.id}`}
              className="flex items-center justify-between rounded border border-black/10 p-4 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
            >
              <span>{formatUSD(Number(g.buyInAmount))} buy-in · {g.participants.length} players</span>
              <span className="text-sm text-black/60 dark:text-white/60">
                {g.startedAt.toLocaleDateString()}
              </span>
            </Link>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase text-black/50 dark:text-white/50">
          Completed
        </h2>
        {completed.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No completed games yet.</p>
        ) : (
          completed.map((g) => (
            <Link
              key={g.id}
              href={`/games/${g.id}`}
              className="flex items-center justify-between rounded border border-black/10 p-4 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
            >
              <span>{formatUSD(Number(g.buyInAmount))} buy-in · {g.participants.length} players</span>
              <span className="text-sm text-black/60 dark:text-white/60">
                {g.startedAt.toLocaleDateString()}
              </span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
