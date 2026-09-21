import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getNextAvailableTable } from "@/lib/tables";

const schema = z.object({
  type: z.enum(["user", "guest"]),
  id: z.string().min(1),
  amount: z.number().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: gameId } = await params;

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Only the game creator can add players" }, { status: 403 });
  }
  if (game.status !== "ACTIVE") {
    return NextResponse.json({ error: "Game is already closed" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { type, id, amount } = parsed.data;

  if (type === "user") {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.status !== "APPROVED") {
      return NextResponse.json({ error: "Player not found or not approved" }, { status: 400 });
    }
  } else {
    const guest = await prisma.guest.findUnique({ where: { id } });
    if (!guest || guest.mergedIntoId) {
      return NextResponse.json({ error: "Guest not found" }, { status: 400 });
    }
  }

  const tableNumber = await getNextAvailableTable(gameId);

  try {
    const participant = await prisma.gameParticipant.create({
      data: {
        gameId,
        userId: type === "user" ? id : null,
        guestId: type === "guest" ? id : null,
        tableNumber,
        totalBoughtIn: amount,
        transactions: { create: { type: "BUY_IN", amount } },
      },
    });
    return NextResponse.json({ participant });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "That player is already in this game" }, { status: 409 });
    }
    throw err;
  }
}
