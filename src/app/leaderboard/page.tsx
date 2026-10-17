import { getLeaderboardRows } from "@/lib/get-leaderboard-rows";
import { LeaderboardTable } from "@/components/leaderboard-table";

export default async function LeaderboardPage() {
  const rows = await getLeaderboardRows();

  return (
    <div className="page">
      <h1 className="page-title">Leaderboard</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          No completed games yet — the leaderboard fills in once games are
          closed out.
        </p>
      ) : (
        <LeaderboardTable rows={rows} />
      )}
    </div>
  );
}
