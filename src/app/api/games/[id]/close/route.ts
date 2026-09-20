import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  cashouts: z
    .array(z.object({ participantId: z.string().min(1), amount: z.number().nonnegative() }))
    .min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: gameId } = await params;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { participants: true },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Only the game creator can close this game" }, { status: 403 });
  }
  if (game.status !== "ACTIVE") {
    return NextResponse.json({ error: "Game is already closed" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { cashouts } = parsed.data;

  const participantIds = new Set(game.participants.map((p) => p.id));
  if (
    cashouts.length !== game.participants.length ||
    !cashouts.every((c) => participantIds.has(c.participantId))
  ) {
    return NextResponse.json(
      { error: "A cash-out amount is required for every player before closing." },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const c of cashouts) {
      const participant = game.participants.find((p) => p.id === c.participantId)!;
      const current = participant.totalCashedOut !== null ? Number(participant.totalCashedOut) : null;
      if (current !== c.amount) {
        await tx.transaction.create({
          data: { participantId: c.participantId, type: "CASH_OUT", amount: c.amount },
        });
        await tx.gameParticipant.update({
          where: { id: c.participantId },
          data: { totalCashedOut: c.amount, leftAt: new Date() },
        });
      }
    }

    await tx.game.update({
      where: { id: gameId },
      data: { status: "COMPLETED", endedAt: new Date() },
    });
  });

  const totalBoughtIn = game.participants.reduce((sum, p) => sum + Number(p.totalBoughtIn), 0);
  const totalCashedOut = cashouts.reduce((sum, c) => sum + c.amount, 0);
  const diff = Math.round((totalCashedOut - totalBoughtIn) * 100) / 100;

  return NextResponse.json({
    ok: true,
    reconciliation: { totalBoughtIn, totalCashedOut, diff, balanced: diff === 0 },
  });
}
