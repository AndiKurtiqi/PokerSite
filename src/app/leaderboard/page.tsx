import { getLeaderboardRows } from "@/lib/get-leaderboard-rows";
import { LeaderboardTable } from "@/components/leaderboard-table";

export default async function LeaderboardPage() {
  const rows = await getLeaderboardRows();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          No completed games yet — the leaderboard fills in once games are
          closed out.
        </p>
      ) : (
        <LeaderboardTable rows={rows} />
      )}
    </div>
  );
}
