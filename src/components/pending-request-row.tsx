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
    <tr className="border-b border-black/10 dark:border-white/10">
      <td className="py-2">{displayName}</td>
      <td className="py-2 text-black/60 dark:text-white/60">{email}</td>
      <td className="flex justify-end gap-2 py-2">
        <button
          onClick={() => act("APPROVED")}
          disabled={loading !== null}
          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading === "APPROVED" ? "Approving..." : "Approve"}
        </button>
        <button
          onClick={() => act("REJECTED")}
          disabled={loading !== null}
          className="rounded border border-black/20 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/20"
        >
          {loading === "REJECTED" ? "Rejecting..." : "Reject"}
        </button>
      </td>
    </tr>
  );
}
