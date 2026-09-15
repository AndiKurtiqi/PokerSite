import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function PendingPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.status === "APPROVED") redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Awaiting approval</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        Your account request is waiting on an admin to approve it. Check
        back soon.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit" className="text-sm underline">
          Log out
        </button>
      </form>
    </div>
  );
}
