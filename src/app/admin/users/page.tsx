import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRow } from "@/components/user-row";

export default async function AdminUsersPage() {
  const session = await auth();

  const users = await prisma.user.findMany({
    where: { status: { not: "PENDING" } },
    orderBy: { createdAt: "asc" },
  });

  const rows = await Promise.all(
    users.map(async (user) => {
      const [participantCount, gamesCreatedCount, guestsCreatedCount, chipSetCount] =
        await Promise.all([
          prisma.gameParticipant.count({ where: { userId: user.id } }),
          prisma.game.count({ where: { creatorId: user.id } }),
          prisma.guest.count({ where: { createdById: user.id } }),
          prisma.chipSet.count({ where: { ownerId: user.id } }),
        ]);

      return {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        canDelete:
          participantCount === 0 &&
          gamesCreatedCount === 0 &&
          guestsCreatedCount === 0 &&
          chipSetCount === 0,
      };
    })
  );

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Accounts</h1>
        <p className="text-sm text-muted">
          Disable an account to block their login while keeping their game
          history and leaderboard stats intact. Permanent deletion is only
          available for accounts with no game history, guests, or chip sets.
        </p>
      </div>

      <div className="border border-line rounded-xl bg-surface">
        {rows.map((row) => (
          <UserRow key={row.id} user={row} isSelf={row.id === session!.user.id} />
        ))}
      </div>
    </div>
  );
}
