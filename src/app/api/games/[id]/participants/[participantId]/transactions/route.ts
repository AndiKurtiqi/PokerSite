import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    type: z.enum(["REBUY", "CASH_OUT"]),
    amount: z.number().nonnegative(),
  })
  .refine((data) => data.type !== "REBUY" || data.amount > 0, {
    message: "Rebuy amount must be greater than zero",
    path: ["amount"],
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: gameId, participantId } = await params;

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Only the game creator can record transactions" }, { status: 403 });
  }
  if (game.status !== "ACTIVE") {
    return NextResponse.json({ error: "Game is already closed" }, { status: 400 });
  }

  const participant = await prisma.gameParticipant.findFirst({
    where: { id: participantId, gameId },
  });
  if (!participant) return NextResponse.json({ error: "Participant not found" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { type, amount } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.transaction.create({
      data: { participantId, type, amount },
    });

    if (type === "REBUY") {
      return tx.gameParticipant.update({
        where: { id: participantId },
        data: { totalBoughtIn: { increment: amount } },
      });
    }

    return tx.gameParticipant.update({
      where: { id: participantId },
      data: { totalCashedOut: amount, leftAt: new Date() },
    });
  });

  return NextResponse.json({ participant: updated });
}
