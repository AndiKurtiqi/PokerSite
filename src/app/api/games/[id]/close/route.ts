import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: gameId } = await params;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { participants: { include: { user: true, guest: true } } },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Only the game creator can close this game" }, { status: 403 });
  }
  if (game.status !== "ACTIVE") {
    return NextResponse.json({ error: "Game is already closed" }, { status: 400 });
  }

  const missingCashout = game.participants.filter((p) => p.totalCashedOut === null);
  if (missingCashout.length > 0) {
    const names = missingCashout.map((p) => p.user?.displayName ?? p.guest?.name ?? "Unknown");
    return NextResponse.json(
      { error: `Record a cash-out for everyone first: ${names.join(", ")}` },
      { status: 400 }
    );
  }

  const totalBoughtIn = game.participants.reduce((sum, p) => sum + Number(p.totalBoughtIn), 0);
  const totalCashedOut = game.participants.reduce((sum, p) => sum + Number(p.totalCashedOut), 0);

  await prisma.game.update({
    where: { id: gameId },
    data: { status: "COMPLETED", endedAt: new Date() },
  });

  const diff = Math.round((totalCashedOut - totalBoughtIn) * 100) / 100;

  return NextResponse.json({
    ok: true,
    reconciliation: {
      totalBoughtIn,
      totalCashedOut,
      diff,
      balanced: diff === 0,
    },
  });
}
