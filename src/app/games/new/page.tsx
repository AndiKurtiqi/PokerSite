import { auth } from "@/auth";
import { NewGameForm } from "@/components/new-game-form";

export default async function NewGamePage() {
  const session = await auth();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">New game</h1>
      <NewGameForm
        creatorId={session!.user.id}
        creatorName={session!.user.name ?? "You"}
      />
    </div>
  );
}
