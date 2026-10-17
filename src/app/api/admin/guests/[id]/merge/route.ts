import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Merge into a real account (targetUserId) or into another guest (targetGuestId).
const schema = z
  .object({
    targetUserId: z.string().min(1).optional(),
    targetGuestId: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.targetUserId) !== Boolean(v.targetGuestId), {
    message: "Provide exactly one merge target.",
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: guestId } = await params;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { targetUserId, targetGuestId } = parsed.data;

  const guest = await prisma.guest.findUnique({ where: { id: guestId } });
  if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  if (guest.mergedIntoId) {
    return NextResponse.json({ error: "This guest has already been merged." }, { status: 400 });
  }

  let targetName: string;
  if (targetUserId) {
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser || targetUser.status !== "APPROVED") {
      return NextResponse.json({ error: "Target account not found or not approved." }, { status: 400 });
    }
    targetName = targetUser.displayName;
  } else {
    if (targetGuestId === guestId) {
      return NextResponse.json({ error: "A guest can't be merged into itself." }, { status: 400 });
    }
    const targetGuest = await prisma.guest.findUnique({ where: { id: targetGuestId! } });
    if (!targetGuest || targetGuest.mergedIntoId) {
      return NextResponse.json({ error: "Target guest not found or already merged." }, { status: 400 });
    }
    targetName = targetGuest.name;
  }

  const guestParticipations = await prisma.gameParticipant.findMany({
    where: { guestId },
    select: { id: true, gameId: true },
  });

  if (guestParticipations.length > 0) {
    const gameIds = guestParticipations.map((p) => p.gameId);
    const conflicts = await prisma.gameParticipant.findMany({
      where: {
        gameId: { in: gameIds },
        ...(targetUserId ? { userId: targetUserId } : { guestId: targetGuestId }),
      },
      select: { gameId: true },
    });
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: `${targetName} already has a seat in ${conflicts.length} of this guest's games, so those can't be auto-merged. Resolve manually first.`,
        },
        { status: 409 }
      );
    }
  }

  // mergedIntoId holds the id of whichever account or guest this one was folded into.
  await prisma.$transaction([
    prisma.gameParticipant.updateMany({
      where: { guestId },
      data: targetUserId
        ? { userId: targetUserId, guestId: null }
        : { guestId: targetGuestId },
    }),
    prisma.guest.update({
      where: { id: guestId },
      data: { mergedIntoId: targetUserId ?? targetGuestId },
    }),
  ]);

  return NextResponse.json({ ok: true, mergedSessions: guestParticipations.length });
}
