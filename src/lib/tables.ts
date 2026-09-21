import { prisma } from "@/lib/prisma";

export const MAX_PLAYERS_PER_TABLE = 9;

/** Bucket an ordered roster (e.g. at game creation) into tables of at most 9. */
export function tableForIndex(index: number): number {
  return Math.floor(index / MAX_PLAYERS_PER_TABLE) + 1;
}

/** Given current occupancy per table, find the first table with room, or open a new one. */
export function pickAvailableTable(countsByTable: Map<number, number>): number {
  let table = 1;
  while ((countsByTable.get(table) ?? 0) >= MAX_PLAYERS_PER_TABLE) {
    table++;
  }
  return table;
}

/** Looks up current per-table occupancy for a game and picks the first table with room. */
export async function getNextAvailableTable(gameId: string): Promise<number> {
  const participants = await prisma.gameParticipant.findMany({
    where: { gameId },
    select: { tableNumber: true },
  });
  const counts = new Map<number, number>();
  for (const p of participants) {
    counts.set(p.tableNumber, (counts.get(p.tableNumber) ?? 0) + 1);
  }
  return pickAvailableTable(counts);
}
