import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length === 0) {
    return NextResponse.json({ friends: [], guests: [], others: [] });
  }

  const friendships = await prisma.friendship.findMany({
    where: { ownerId: session.user.id },
    select: { friendId: true },
  });
  const friendIds = friendships.map((f) => f.friendId);

  const [friendUsers, otherUsers, guests] = await Promise.all([
    friendIds.length === 0
      ? []
      : prisma.user.findMany({
          where: {
            id: { in: friendIds },
            status: "APPROVED",
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
        }),
    prisma.user.findMany({
      where: {
        id: { notIn: [...friendIds, session.user.id] },
        status: "APPROVED",
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    prisma.guest.findMany({
      where: {
        createdById: session.user.id,
        mergedIntoId: null,
        name: { contains: q, mode: "insensitive" },
      },
      take: 5,
    }),
  ]);

  return NextResponse.json({
    friends: friendUsers.map((u) => ({
      type: "user" as const,
      id: u.id,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      isFriend: true,
    })),
    guests: guests.map((g) => ({ type: "guest" as const, id: g.id, name: g.name })),
    others: otherUsers.map((u) => ({
      type: "user" as const,
      id: u.id,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      isFriend: false,
    })),
  });
}
