import { describe, expect, it } from "vitest";
import { computeChipPlan } from "@/lib/chip-plan";

const STANDARD = [
  { valueCents: 25, quantity: 100 },
  { valueCents: 50, quantity: 100 },
  { valueCents: 100, quantity: 50 },
  { valueCents: 500, quantity: 25 },
];

const totalPerPlayer = (plan: ReturnType<typeof computeChipPlan>) =>
  plan.perPlayer.reduce((sum, l) => sum + l.valueCents * l.countPerPlayer, 0);

describe("computeChipPlan", () => {
  it("splits a $20 buy-in evenly across denominations and sums to exactly $20", () => {
    const plan = computeChipPlan(2000, STANDARD, 4);
    expect(plan.perPlayer.map((l) => l.countPerPlayer)).toEqual([20, 10, 5, 1]);
    expect(totalPerPlayer(plan)).toBe(2000);
    expect(plan.warnings).toEqual([]);
  });

  it("orders lines from smallest to largest denomination regardless of input order", () => {
    const plan = computeChipPlan(2000, [...STANDARD].reverse(), 4);
    expect(plan.perPlayer.map((l) => l.valueCents)).toEqual([25, 50, 100, 500]);
  });

  it("still sums to the buy-in when rounding leaves a remainder (smallest chip absorbs it)", () => {
    const plan = computeChipPlan(
      2000,
      [
        { valueCents: 25, quantity: 500 },
        { valueCents: 200, quantity: 50 },
        { valueCents: 500, quantity: 50 },
      ],
      2
    );
    expect(totalPerPlayer(plan)).toBe(2000);
  });

  it("ignores denominations larger than the buy-in", () => {
    const plan = computeChipPlan(
      500,
      [
        { valueCents: 25, quantity: 100 },
        { valueCents: 100, quantity: 100 },
        { valueCents: 2500, quantity: 100 },
      ],
      3
    );
    expect(plan.perPlayer.map((l) => l.valueCents)).toEqual([25, 100]);
    expect(totalPerPlayer(plan)).toBe(500);
  });

  it("warns when the table needs more chips of a color than are owned", () => {
    const plan = computeChipPlan(
      2000,
      [
        { valueCents: 25, quantity: 10 }, // need 20 per player
        { valueCents: 100, quantity: 500 },
      ],
      3
    );
    expect(plan.warnings.some((w) => w.includes("$0.25") && w.includes("only 10"))).toBe(true);
  });

  it("does not warn when inventory covers every player", () => {
    const plan = computeChipPlan(2000, STANDARD, 5);
    expect(plan.warnings).toEqual([]);
  });

  it("warns when denomination rounding can't hit the buy-in exactly", () => {
    // A single 25-cent chip can't make $10.10 (1010 cents) exactly.
    const plan = computeChipPlan(1010, [{ valueCents: 25, quantity: 1000 }], 1);
    expect(plan.warnings.some((w) => w.includes("off by 0.10"))).toBe(true);
  });

  it("returns an empty plan with a warning when no denomination fits the buy-in", () => {
    const plan = computeChipPlan(10, [{ valueCents: 25, quantity: 100 }], 2);
    expect(plan.perPlayer).toEqual([]);
    expect(plan.warnings[0]).toMatch(/no usable chip denominations/i);
  });

  it("returns an empty plan when there are no players", () => {
    const plan = computeChipPlan(2000, STANDARD, 0);
    expect(plan.perPlayer).toEqual([]);
    expect(plan.totalPlayers).toBe(0);
  });
});
