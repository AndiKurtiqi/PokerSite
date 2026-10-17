"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PendingRequestRow({
  id,
  displayName,
  email,
}: {
  id: string;
  displayName: string;
  email: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"APPROVED" | "REJECTED" | null>(null);

  async function act(status: "APPROVED" | "REJECTED") {
    setLoading(status);
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <tr className="border-b border-line">
      <td className="py-2">{displayName}</td>
      <td className="py-2 text-muted">{email}</td>
      <td className="flex justify-end gap-2 py-2">
        <button
          onClick={() => act("APPROVED")}
          disabled={loading !== null}
          className="px-3 py-1 text-sm disabled:opacity-50 btn-primary"
        >
          {loading === "APPROVED" ? "Approving..." : "Approve"}
        </button>
        <button
          onClick={() => act("REJECTED")}
          disabled={loading !== null}
          className="px-3 py-1 text-sm disabled:opacity-50 btn-secondary"
        >
          {loading === "REJECTED" ? "Rejecting..." : "Reject"}
        </button>
      </td>
    </tr>
  );
}
