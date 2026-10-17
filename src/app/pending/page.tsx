import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";

export default async function PendingPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.status === "APPROVED") redirect("/dashboard");

  const isDisabled = session.user.status === "DISABLED";

  return (
    <AuthShell
      title={isDisabled ? "Account disabled" : "Awaiting approval"}
      subtitle={
        isDisabled
          ? "An admin has disabled this account. Contact an admin if you think this is a mistake."
          : "Your account request is waiting on an admin to approve it. Check back soon."
      }
    >
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit" className="btn-secondary px-4 py-2 text-sm">
          Log out
        </button>
      </form>
    </AuthShell>
  );
}
