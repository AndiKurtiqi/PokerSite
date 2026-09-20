import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  displayName: z.string().min(1).max(50),
  avatarUrl: z.union([z.string().url(), z.literal("")]),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { displayName, avatarUrl } = parsed.data;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { displayName, avatarUrl: avatarUrl || null },
  });

  return NextResponse.json({
    user: { displayName: user.displayName, avatarUrl: user.avatarUrl },
  });
}
