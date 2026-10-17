import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatUSD } from "@/lib/money";

export default async function ChipSetsPage() {
  const session = await auth();
  const chipSets = await prisma.chipSet.findMany({
    where: { ownerId: session!.user.id },
    include: { denominations: { orderBy: { value: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="page">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Chip sets</h1>
        <Link
          href="/chip-sets/new"
          className="px-4 py-2 text-sm btn-primary"
        >
          New chip set
        </Link>
      </div>

      {chipSets.length === 0 ? (
        <p className="text-sm text-muted">
          No chip sets yet. Create one to start using the buy-in calculator
          when setting up a game.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {chipSets.map((set) => (
            <div
              key={set.id}
              className="border p-4 border-line rounded-xl bg-surface"
            >
              <h2 className="font-medium">{set.name}</h2>
              <ul className="mt-2 flex flex-wrap gap-3 text-sm text-muted">
                {set.denominations.map((d) => (
                  <li key={d.id}>
                    {formatUSD(Number(d.value))} × {d.quantity}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
