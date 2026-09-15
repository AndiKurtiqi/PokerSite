import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">
        Welcome, {session?.user.name}
      </h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        This is a placeholder dashboard. Friends, games, and the leaderboard
        will live behind their own nav links as they&apos;re built out.
      </p>
    </div>
  );
}
