import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile-form";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function SettingsPage() {
  const session = await auth();
  const user = await prisma.user.findUnique({ where: { id: session!.user.id } });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-10 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Account settings</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Logged in as {user?.email}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Profile</h2>
        <ProfileForm
          initialDisplayName={user?.displayName ?? ""}
          initialAvatarUrl={user?.avatarUrl ?? ""}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
