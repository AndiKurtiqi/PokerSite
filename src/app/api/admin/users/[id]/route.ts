import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "DISABLED"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "You can't change your own account status." }, { status: 400 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ ok: true, user: { id: user.id, status: user.status } });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const [participantCount, gamesCreatedCount, guestsCreatedCount, chipSetCount] = await Promise.all([
    prisma.gameParticipant.count({ where: { userId: id } }),
    prisma.game.count({ where: { creatorId: id } }),
    prisma.guest.count({ where: { createdById: id } }),
    prisma.chipSet.count({ where: { ownerId: id } }),
  ]);

  if (participantCount > 0 || gamesCreatedCount > 0 || guestsCreatedCount > 0 || chipSetCount > 0) {
    return NextResponse.json(
      { error: "This account has game history, guests, or chip sets tied to it and can't be permanently deleted. Disable it instead." },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
