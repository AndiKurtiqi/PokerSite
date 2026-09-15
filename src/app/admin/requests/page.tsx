import { prisma } from "@/lib/prisma";
import { PendingRequestRow } from "@/components/pending-request-row";

export default async function AdminRequestsPage() {
  const pending = await prisma.user.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Pending requests</h1>
      {pending.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          No pending account requests.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Email</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pending.map((user) => (
              <PendingRequestRow
                key={user.id}
                id={user.id}
                displayName={user.displayName}
                email={user.email}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
