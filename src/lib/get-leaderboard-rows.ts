import { prisma } from "@/lib/prisma";
import { computeLeaderboard, type SessionResult } from "@/lib/leaderboard";

export async function getLeaderboardRows() {
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

  return computeLeaderboard(sessions);
}
