import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatUSD } from "@/lib/money";

export default async function GamesPage() {
  const games = await prisma.game.findMany({
    include: { participants: true, creator: { select: { displayName: true } } },
    orderBy: { startedAt: "desc" },
  });

  const active = games.filter((g) => g.status === "ACTIVE");
  const completed = games.filter((g) => g.status === "COMPLETED");

  return (
    <div className="page gap-8">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Games</h1>
        <Link
          href="/games/new"
          className="px-4 py-2 text-sm btn-primary"
        >
          New game
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="section-label">
          Active
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted">No active games.</p>
        ) : (
          active.map((g) => (
            <Link
              key={g.id}
              href={`/games/${g.id}`}
              className="flex items-center justify-between card p-4 transition-colors hover:border-line-strong hover:bg-surface-raised"
            >
              <span className="flex items-center gap-2.5">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-success" />
                {formatUSD(Number(g.buyInAmount))} buy-in · {g.participants.length} player{g.participants.length === 1 ? "" : "s"} ·
                banked by {g.creator.displayName}
              </span>
              <span className="text-sm text-muted">
                {g.startedAt.toLocaleDateString()}
              </span>
            </Link>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-label">
          Completed
        </h2>
        {completed.length === 0 ? (
          <p className="text-sm text-muted">No completed games yet.</p>
        ) : (
          completed.map((g) => (
            <Link
              key={g.id}
              href={`/games/${g.id}`}
              className="flex items-center justify-between card p-4 transition-colors hover:border-line-strong hover:bg-surface-raised"
            >
              <span>
                {formatUSD(Number(g.buyInAmount))} buy-in · {g.participants.length} player{g.participants.length === 1 ? "" : "s"} ·
                banked by {g.creator.displayName}
              </span>
              <span className="text-sm text-muted">
                {g.startedAt.toLocaleDateString()}
              </span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
