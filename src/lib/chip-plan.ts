export type DenominationInput = {
  valueCents: number;
  quantity: number;
};

export type ChipPlanLine = {
  valueCents: number;
  countPerPlayer: number;
};

export type ChipPlan = {
  totalPlayers: number;
  perPlayer: ChipPlanLine[];
  warnings: string[];
};

/**
 * Splits a buy-in amount into a chip breakdown for a single player, aiming
 * for a roughly equal dollar-value split across the available denominations
 * (ascending), then reconciles any rounding remainder using the smallest
 * denomination. Also checks the resulting per-player counts against total
 * owned inventory across the whole table.
 */
export function computeChipPlan(
  buyInCents: number,
  denominations: DenominationInput[],
  numPlayers: number
): ChipPlan {
  const usable = denominations
    .filter((d) => d.valueCents > 0 && d.valueCents <= buyInCents)
    .sort((a, b) => a.valueCents - b.valueCents);

  if (usable.length === 0 || numPlayers <= 0) {
    return { totalPlayers: numPlayers, perPlayer: [], warnings: ["No usable chip denominations for this buy-in."] };
  }

  const targetPerDenom = buyInCents / usable.length;
  const lines: ChipPlanLine[] = usable.map((d) => ({
    valueCents: d.valueCents,
    countPerPlayer: Math.max(0, Math.round(targetPerDenom / d.valueCents)),
  }));

  let allocated = lines.reduce((sum, l) => sum + l.countPerPlayer * l.valueCents, 0);
  const smallest = lines[0];
  let remainder = buyInCents - allocated;

  // Reconcile rounding remainder using the smallest denomination.
  const smallestSteps = Math.round(remainder / smallest.valueCents);
  smallest.countPerPlayer = Math.max(0, smallest.countPerPlayer + smallestSteps);
  allocated = lines.reduce((sum, l) => sum + l.countPerPlayer * l.valueCents, 0);
  remainder = buyInCents - allocated;

  const warnings: string[] = [];
  if (remainder !== 0) {
    warnings.push(
      `Chip plan is off by ${(remainder / 100).toFixed(2)} per player due to denomination rounding.`
    );
  }

  for (const line of lines) {
    const needed = line.countPerPlayer * numPlayers;
    const owned = denominations.find((d) => d.valueCents === line.valueCents)?.quantity ?? 0;
    if (needed > owned) {
      warnings.push(
        `Need ${needed} chips worth $${(line.valueCents / 100).toFixed(2)} for ${numPlayers} players, but only ${owned} on hand.`
      );
    }
  }

  return { totalPlayers: numPlayers, perPlayer: lines, warnings };
}
