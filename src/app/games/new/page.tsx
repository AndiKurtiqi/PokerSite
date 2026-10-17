import { auth } from "@/auth";
import { NewGameForm } from "@/components/new-game-form";

export default async function NewGamePage() {
  const session = await auth();

  return (
    <div className="page-narrow">
      <h1 className="page-title">New game</h1>
      <NewGameForm
        creatorId={session!.user.id}
        creatorName={session!.user.name ?? "You"}
      />
    </div>
  );
}
