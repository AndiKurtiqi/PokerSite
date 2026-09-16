import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatUSD } from "@/lib/money";
import { Avatar } from "@/components/avatar";
import { AddFriendSearch } from "@/components/add-friend-search";

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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Friends</h1>

      <AddFriendSearch />

      {friendships.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          No friends yet. Search above, or add players while setting up a
          game.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 rounded border border-black/10 dark:divide-white/10 dark:border-white/10">
          {friendships.map(({ friend }) => {
            const stats = statsByUserId.get(friend.id);
            return (
              <li key={friend.id} className="flex items-center gap-3 p-4">
                <Avatar name={friend.displayName} avatarUrl={friend.avatarUrl} />
                <div className="flex flex-col">
                  <span className="font-medium">{friend.displayName}</span>
                  <span className="text-sm text-black/60 dark:text-white/60">
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
