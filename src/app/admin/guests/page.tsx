import { prisma } from "@/lib/prisma";
import { formatUSD } from "@/lib/money";
import { MergeGuestControl } from "@/components/merge-guest-control";

export default async function AdminGuestsPage() {
  const guests = await prisma.guest.findMany({
    where: { mergedIntoId: null },
    include: { createdBy: { select: { displayName: true } } },
    orderBy: { createdAt: "asc" },
  });

  const guestIds = guests.map((g) => g.id);
  const participants =
    guestIds.length === 0
      ? []
      : await prisma.gameParticipant.findMany({
          where: {
            guestId: { in: guestIds },
            game: { status: "COMPLETED" },
            totalCashedOut: { not: null },
          },
        });

  const statsByGuestId = new Map<string, { sessions: number; net: number }>();
  for (const p of participants) {
    const existing = statsByGuestId.get(p.guestId!) ?? { sessions: 0, net: 0 };
    existing.sessions += 1;
    existing.net += Number(p.totalCashedOut) - Number(p.totalBoughtIn);
    statsByGuestId.set(p.guestId!, existing);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Merge guests</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Once a guest player creates a real account, merge their guest
          identity into it so their session history and leaderboard stats
          carry over.
        </p>
      </div>

      {guests.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          No unmerged guests.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 rounded border border-black/10 dark:divide-white/10 dark:border-white/10">
          {guests.map((guest) => {
            const stats = statsByGuestId.get(guest.id) ?? { sessions: 0, net: 0 };
            return (
              <li key={guest.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{guest.name}</p>
                    <p className="text-sm text-black/60 dark:text-white/60">
                      Added by {guest.createdBy.displayName} · {stats.sessions} session
                      {stats.sessions === 1 ? "" : "s"}
                      {stats.sessions > 0 && (
                        <>
                          {" · "}
                          {stats.net >= 0 ? "+" : ""}
                          {formatUSD(stats.net)}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <MergeGuestControl
                  guestId={guest.id}
                  guestName={guest.name}
                  sessions={stats.sessions}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
