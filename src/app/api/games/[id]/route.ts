import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: gameId } = await params;

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const isCreator = game.creatorId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isCreator && !isAdmin) {
    return NextResponse.json(
      { error: "Only the game's creator or an admin can delete it" },
      { status: 403 }
    );
  }

  await prisma.game.delete({ where: { id: gameId } });

  return NextResponse.json({ ok: true });
}
