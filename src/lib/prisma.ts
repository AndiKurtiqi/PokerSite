import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
const isLocalDb =
  connectionString?.includes("localhost") || connectionString?.includes("127.0.0.1");

const adapter = new PrismaPg({
  connectionString,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
