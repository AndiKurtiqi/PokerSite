import { prisma } from "@/lib/prisma";
import { PendingRequestRow } from "@/components/pending-request-row";

export default async function AdminRequestsPage() {
  const pending = await prisma.user.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="page">
      <h1 className="page-title">Pending requests</h1>
      {pending.length === 0 ? (
        <p className="text-sm text-muted">
          No pending account requests.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line">
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
