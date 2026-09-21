import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getNextAvailableTable } from "@/lib/tables";

const schema = z.object({ amount: z.number().positive() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: gameId } = await params;

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status !== "ACTIVE") {
    return NextResponse.json({ error: "This game is already closed." }, { status: 400 });
  }

  const existing = await prisma.gameParticipant.findFirst({
    where: { gameId, userId: session.user.id },
  });
  if (existing) {
    return NextResponse.json({ error: "You're already in this game." }, { status: 400 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { amount } = parsed.data;
  const tableNumber = await getNextAvailableTable(gameId);

  try {
    const participant = await prisma.gameParticipant.create({
      data: {
        gameId,
        userId: session.user.id,
        tableNumber,
        totalBoughtIn: amount,
        transactions: { create: { type: "BUY_IN", amount } },
      },
    });
    return NextResponse.json({ participant });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "You're already in this game." }, { status: 409 });
    }
    throw err;
  }
}
