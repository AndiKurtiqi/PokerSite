import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile-form";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function SettingsPage() {
  const session = await auth();
  const user = await prisma.user.findUnique({ where: { id: session!.user.id } });

  return (
    <div className="page-narrow gap-10">
      <div>
        <h1 className="page-title">Account settings</h1>
        <p className="text-sm text-muted">
          Logged in as {user?.email}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        <ProfileForm
          initialDisplayName={user?.displayName ?? ""}
          initialAvatarUrl={user?.avatarUrl ?? ""}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
