"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserRowData = {
  id: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  canDelete: boolean;
};

export function UserRow({ user, isSelf }: { user: UserRowData; isSelf: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: "APPROVED" | "DISABLED") {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function deleteUser() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 border-b border-black/10 p-4 last:border-0 dark:border-white/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">
            {user.displayName}
            {user.role === "ADMIN" && (
              <span className="ml-2 text-xs text-black/40 dark:text-white/40">admin</span>
            )}
            {isSelf && (
              <span className="ml-2 text-xs text-black/40 dark:text-white/40">you</span>
            )}
          </p>
          <p className="text-sm text-black/60 dark:text-white/60">
            {user.email} · {user.status.toLowerCase()} · joined{" "}
            {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>

        {!isSelf && (
          <div className="flex items-center gap-2">
            {user.status === "DISABLED" ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => setStatus("APPROVED")}
                className="rounded border border-black/20 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/20"
              >
                Re-enable
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={() => setStatus("DISABLED")}
                className="rounded border border-black/20 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/20"
              >
                Disable
              </button>
            )}

            {user.canDelete &&
              (confirmingDelete ? (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={deleteUser}
                    className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                  >
                    {loading ? "Deleting..." : "Confirm delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="text-sm underline"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 dark:border-red-800"
                >
                  Delete permanently
                </button>
              ))}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
