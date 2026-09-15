import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "andikurtiqi@gmail.com";
  const password = process.env.ADMIN_PASSWORD ?? "changeme123";
  const displayName = process.env.ADMIN_NAME ?? "Andi";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      role: "ADMIN",
      status: "APPROVED",
    },
  });

  console.log(`Created admin user: ${email} (password: ${password})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
