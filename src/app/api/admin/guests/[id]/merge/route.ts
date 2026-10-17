import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Merge into a real account (targetUserId) or into another guest (targetGuestId).
const schema = z
  .object({
    targetUserId: z.string().min(1).optional(),
    targetGuestId: z.string().min(1).optional(),
    // Confirm that games where both already have a seat should have those seats combined.
    combineSeats: z.boolean().optional(),
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
  const { targetUserId, targetGuestId, combineSeats } = parsed.data;

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
  });

  // Games where the target already has its own seat next to this guest's (for
  // example someone rebought by adding a second guest): those two seats are
  // the same person twice and have to be combined into one.
  const overlaps =
    guestParticipations.length === 0
      ? []
      : await prisma.gameParticipant.findMany({
          where: {
            gameId: { in: guestParticipations.map((p) => p.gameId) },
            ...(targetUserId ? { userId: targetUserId } : { guestId: targetGuestId }),
          },
        });
  const keptByGame = new Map(overlaps.map((p) => [p.gameId, p]));
  const duplicateSeats = guestParticipations.filter((p) => keptByGame.has(p.gameId));

  if (duplicateSeats.length > 0) {
    // A seat that cashed out and one still playing can't be added together
    // until the game is settled.
    const unsettled = duplicateSeats.filter(
      (d) => (d.totalCashedOut === null) !== (keptByGame.get(d.gameId)!.totalCashedOut === null)
    );

    if (unsettled.length > 0) {
      return NextResponse.json(
        {
          error: `${targetName} and this guest are both in ${unsettled.length} game(s) where one seat has cashed out and the other is still playing. Cash out or close those games first, then merge.`,
          canCombine: false,
        },
        { status: 409 }
      );
    }

    if (!combineSeats) {
      return NextResponse.json(
        {
          error: `${targetName} already has a seat in ${duplicateSeats.length} of this guest's games. Combine those seats (buy-ins and cash-outs are added together) to merge.`,
          canCombine: true,
          overlaps: duplicateSeats.length,
        },
        { status: 409 }
      );
    }
  }

  // mergedIntoId holds the id of whichever account or guest this one was folded into.
  await prisma.$transaction(async (tx) => {
    for (const dupe of duplicateSeats) {
      const keep = keptByGame.get(dupe.gameId)!;
      await tx.transaction.updateMany({
        where: { participantId: dupe.id },
        data: { participantId: keep.id },
      });
      await tx.gameParticipant.update({
        where: { id: keep.id },
        data: {
          totalBoughtIn: keep.totalBoughtIn.add(dupe.totalBoughtIn),
          totalCashedOut:
            keep.totalCashedOut && dupe.totalCashedOut
              ? keep.totalCashedOut.add(dupe.totalCashedOut)
              : null,
        },
      });
      await tx.gameParticipant.delete({ where: { id: dupe.id } });
    }

    await tx.gameParticipant.updateMany({
      where: { guestId },
      data: targetUserId
        ? { userId: targetUserId, guestId: null }
        : { guestId: targetGuestId },
    });
    await tx.guest.update({
      where: { id: guestId },
      data: { mergedIntoId: targetUserId ?? targetGuestId },
    });
  });

  return NextResponse.json({
    ok: true,
    mergedSessions: guestParticipations.length,
    combinedSeats: duplicateSeats.length,
  });
}
