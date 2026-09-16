import { prisma } from "@/lib/prisma";
import { computeLeaderboard, type SessionResult } from "@/lib/leaderboard";
import { LeaderboardTable } from "@/components/leaderboard-table";

export default async function LeaderboardPage() {
  const participants = await prisma.gameParticipant.findMany({
    where: { game: { status: "COMPLETED" }, totalCashedOut: { not: null } },
    include: { user: true, guest: true, game: true },
  });

  const sessions: SessionResult[] = participants.map((p) => ({
    key: p.userId ? `user:${p.userId}` : `guest:${p.guestId}`,
    displayName: p.user?.displayName ?? p.guest?.name ?? "Unknown",
    isGuest: p.guestId !== null,
    boughtIn: Number(p.totalBoughtIn),
    cashedOut: Number(p.totalCashedOut),
    endedAt: p.game.endedAt ?? p.game.startedAt,
  }));

  const rows = computeLeaderboard(sessions);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          No completed games yet — the leaderboard fills in once games are
          closed out.
        </p>
      ) : (
        <LeaderboardTable rows={rows} />
      )}
    </div>
  );
}
