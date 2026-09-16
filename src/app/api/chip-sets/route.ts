import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1).max(50),
  denominations: z
    .array(
      z.object({
        value: z.number().positive(),
        quantity: z.number().int().nonnegative(),
      })
    )
    .min(1),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chipSets = await prisma.chipSet.findMany({
    where: { ownerId: session.user.id },
    include: { denominations: { orderBy: { value: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ chipSets });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { name, denominations } = parsed.data;

  const chipSet = await prisma.chipSet.create({
    data: {
      name,
      ownerId: session.user.id,
      denominations: {
        create: denominations.map((d) => ({
          value: d.value,
          quantity: d.quantity,
        })),
      },
    },
    include: { denominations: true },
  });

  return NextResponse.json({ chipSet });
}
