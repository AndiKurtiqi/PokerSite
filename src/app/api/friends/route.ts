import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ friendId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { friendId } = parsed.data;
  if (friendId === session.user.id) {
    return NextResponse.json({ error: "You can't friend yourself." }, { status: 400 });
  }

  const friend = await prisma.user.findUnique({ where: { id: friendId } });
  if (!friend) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.friendship.upsert({
      where: { ownerId_friendId: { ownerId: session.user.id, friendId } },
      create: { ownerId: session.user.id, friendId },
      update: {},
    }),
    prisma.friendship.upsert({
      where: { ownerId_friendId: { ownerId: friendId, friendId: session.user.id } },
      create: { ownerId: friendId, friendId: session.user.id },
      update: {},
    }),
  ]);

  return NextResponse.json({ ok: true });
}
