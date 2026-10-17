import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatUSD } from "@/lib/money";
import { getLeaderboardRows } from "@/lib/get-leaderboard-rows";
import { LeaderboardTable } from "@/components/leaderboard-table";

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const color = tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-foreground";
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="section-label">{label}</span>
      <span className={`tabular text-2xl font-semibold tracking-tight ${color}`}>{value}</span>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const [rows, activeGames] = await Promise.all([
    getLeaderboardRows(),
    prisma.game.findMany({
      where: { status: "ACTIVE" },
      include: { participants: { select: { id: true } }, creator: { select: { displayName: true } } },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const myIndex = rows.findIndex((r) => r.key === `user:${session?.user.id}`);
  const mine = myIndex >= 0 ? rows[myIndex] : null;
  const net = mine?.netProfit ?? 0;

  return (
    <div className="page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Welcome, {session?.user.name}</h1>
          <p className="mt-1 text-sm text-muted">Here&apos;s how the group is doing.</p>
        </div>
        <Link href="/games/new" className="btn-primary px-4 py-2 text-sm">
          + New game
        </Link>
      </div>

      {activeGames.length > 0 && (
        <Link
          href={activeGames.length === 1 ? `/games/${activeGames[0].id}` : "/games"}
          className="card flex items-center justify-between gap-4 border-felt/40 bg-felt/10 p-4 transition-colors hover:bg-felt/20"
        >
          <span className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <span className="font-medium">
              {activeGames.length === 1
                ? `Game in progress · ${activeGames[0].participants.length} player${activeGames[0].participants.length === 1 ? "" : "s"} · banked by ${activeGames[0].creator.displayName}`
                : `${activeGames.length} games in progress`}
            </span>
          </span>
          <span className="text-sm text-muted">Open →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Your net"
          value={mine ? `${net > 0 ? "+" : ""}${formatUSD(net)}` : "—"}
          tone={net > 0 ? "good" : net < 0 ? "bad" : "neutral"}
        />
        <StatCard label="Sessions" value={mine ? String(mine.sessionsPlayed) : "0"} />
        <StatCard label="Rank" value={mine ? `#${myIndex + 1} of ${rows.length}` : "—"} />
        <StatCard
          label="Avg / session"
          value={mine ? formatUSD(mine.avgPerSession) : "—"}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Leaderboard</h2>
        {rows.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">
            No completed games yet — the leaderboard fills in once games are
            closed out.
          </p>
        ) : (
          <LeaderboardTable rows={rows} />
        )}
      </section>
    </div>
  );
}
