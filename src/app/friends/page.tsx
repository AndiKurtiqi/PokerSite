import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatUSD } from "@/lib/money";
import { Avatar } from "@/components/avatar";
import { AddFriendSearch } from "@/components/add-friend-search";
import { SuggestedFriends } from "@/components/suggested-friends";

const SUGGESTIONS_SHOWN = 5;

export default async function FriendsPage() {
  const session = await auth();

  const friendships = await prisma.friendship.findMany({
    where: { ownerId: session!.user.id },
    include: { friend: true },
    orderBy: { createdAt: "asc" },
  });

  const friendIds = friendships.map((f) => f.friendId);

  const participants =
    friendIds.length === 0
      ? []
      : await prisma.gameParticipant.findMany({
          where: {
            userId: { in: friendIds },
            game: { status: "COMPLETED" },
            totalCashedOut: { not: null },
          },
        });

  const statsByUserId = new Map<string, { sessions: number; net: number }>();
  for (const p of participants) {
    const existing = statsByUserId.get(p.userId!) ?? { sessions: 0, net: 0 };
    existing.sessions += 1;
    existing.net += Number(p.totalCashedOut) - Number(p.totalBoughtIn);
    statsByUserId.set(p.userId!, existing);
  }

  // Everyone approved who isn't already a friend, best matches first: people
  // you've played with, then friends of friends, then alphabetical. Adding
  // someone refreshes the page, so the next person slides into the list.
  const candidates = await prisma.user.findMany({
    where: { status: "APPROVED", id: { notIn: [...friendIds, session!.user.id] } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  const candidateIds = candidates.map((c) => c.id);

  const [sharedGames, mutuals] =
    candidateIds.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.gameParticipant.findMany({
            where: {
              userId: { in: candidateIds },
              game: { participants: { some: { userId: session!.user.id } } },
            },
            select: { userId: true },
          }),
          friendIds.length === 0
            ? []
            : prisma.friendship.findMany({
                where: { ownerId: { in: friendIds }, friendId: { in: candidateIds } },
                select: { friendId: true },
              }),
        ]);

  const countBy = (rows: { userId: string | null }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.userId) m.set(r.userId, (m.get(r.userId) ?? 0) + 1);
    return m;
  };
  const sharedByUser = countBy(sharedGames);
  const mutualByUser = countBy(mutuals.map((m) => ({ userId: m.friendId })));

  const ranked = candidates
    .map((c) => {
      const shared = sharedByUser.get(c.id) ?? 0;
      const mutual = mutualByUser.get(c.id) ?? 0;
      const parts = [
        shared > 0 ? `Played ${shared} game${shared === 1 ? "" : "s"} with you` : null,
        mutual > 0 ? `${mutual} mutual friend${mutual === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      return { ...c, shared, mutual, reason: parts.length ? parts.join(" · ") : null };
    })
    .sort(
      (a, b) =>
        b.shared - a.shared ||
        b.mutual - a.mutual ||
        a.displayName.localeCompare(b.displayName)
    );

  return (
    <div className="page">
      <h1 className="page-title">Friends</h1>

      <AddFriendSearch />

      {ranked.length > 0 && (
        <SuggestedFriends
          suggestions={ranked.slice(0, SUGGESTIONS_SHOWN)}
          totalRemaining={ranked.length}
        />
      )}

      {friendships.length === 0 ? (
        <p className="text-sm text-muted">
          No friends yet. Pick from the suggestions, search above, or add
          players while setting up a game.
        </p>
      ) : (
        <ul className="flex flex-col divide-y border border-line rounded-xl bg-surface divide-line">
          {friendships.map(({ friend }) => {
            const stats = statsByUserId.get(friend.id);
            return (
              <li key={friend.id} data-testid="friend-row" className="flex items-center gap-3 p-4">
                <Avatar name={friend.displayName} avatarUrl={friend.avatarUrl} />
                <div className="flex flex-col">
                  <span className="font-medium">{friend.displayName}</span>
                  <span className="text-sm text-muted">
                    {stats
                      ? `${stats.sessions} session${stats.sessions === 1 ? "" : "s"} · ${
                          stats.net >= 0 ? "+" : ""
                        }${formatUSD(stats.net)}`
                      : "No sessions yet"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
