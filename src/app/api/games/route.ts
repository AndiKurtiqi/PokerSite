import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeChipPlan } from "@/lib/chip-plan";
import { dollarsToCents } from "@/lib/money";

const schema = z.object({
  buyInAmount: z.number().positive(),
  chipSetId: z.string().nullable().optional(),
  players: z
    .array(z.object({ type: z.enum(["user", "guest"]), id: z.string() }))
    .min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { buyInAmount, chipSetId, players } = parsed.data;

  const userIds = players.filter((p) => p.type === "user").map((p) => p.id);
  const guestIds = players.filter((p) => p.type === "guest").map((p) => p.id);

  const [validUsers, validGuests] = await Promise.all([
    userIds.length === 0
      ? []
      : prisma.user.findMany({ where: { id: { in: userIds }, status: "APPROVED" } }),
    guestIds.length === 0
      ? []
      : prisma.guest.findMany({ where: { id: { in: guestIds }, createdById: session.user.id } }),
  ]);

  if (validUsers.length !== userIds.length || validGuests.length !== guestIds.length) {
    return NextResponse.json({ error: "One or more selected players are invalid." }, { status: 400 });
  }

  let chipPlan = null;
  if (chipSetId) {
    const chipSet = await prisma.chipSet.findFirst({
      where: { id: chipSetId, ownerId: session.user.id },
      include: { denominations: true },
    });
    if (chipSet) {
      const denominations = chipSet.denominations.map((d) => ({
        valueCents: dollarsToCents(Number(d.value)),
        quantity: d.quantity,
      }));
      chipPlan = computeChipPlan(dollarsToCents(buyInAmount), denominations, players.length);
    }
  }

  const game = await prisma.game.create({
    data: {
      creatorId: session.user.id,
      chipSetId: chipSetId ?? null,
      buyInAmount,
      chipPlan: chipPlan ?? undefined,
      participants: {
        create: players.map((p) => ({
          userId: p.type === "user" ? p.id : null,
          guestId: p.type === "guest" ? p.id : null,
          totalBoughtIn: buyInAmount,
          transactions: { create: { type: "BUY_IN", amount: buyInAmount } },
        })),
      },
    },
  });

  return NextResponse.json({ game });
}
