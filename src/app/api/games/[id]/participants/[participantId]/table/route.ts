import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MAX_PLAYERS_PER_TABLE } from "@/lib/tables";

const schema = z.object({ tableNumber: z.number().int().min(1) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: gameId, participantId } = await params;

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Only the game creator can move players between tables" }, { status: 403 });
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
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { tableNumber } = parsed.data;

  if (tableNumber === participant.tableNumber) {
    return NextResponse.json({ participant });
  }

  const occupancy = await prisma.gameParticipant.count({
    where: { gameId, tableNumber },
  });
  if (occupancy >= MAX_PLAYERS_PER_TABLE) {
    return NextResponse.json(
      { error: `Table ${tableNumber} is already full (${MAX_PLAYERS_PER_TABLE}/${MAX_PLAYERS_PER_TABLE}).` },
      { status: 400 }
    );
  }

  const updated = await prisma.gameParticipant.update({
    where: { id: participantId },
    data: { tableNumber },
  });

  return NextResponse.json({ participant: updated });
}
