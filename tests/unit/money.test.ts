import { describe, expect, it } from "vitest";
import { centsToDollars, dollarsToCents, formatUSD } from "@/lib/money";

describe("money helpers", () => {
  it("converts dollars to whole cents without floating point drift", () => {
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(dollarsToCents(20)).toBe(2000);
  });

  it("converts cents back to dollars", () => {
    expect(centsToDollars(1999)).toBe(19.99);
    expect(centsToDollars(0)).toBe(0);
  });

  it("formats USD with grouping and two decimals", () => {
    expect(formatUSD(1234.5)).toBe("$1,234.50");
    expect(formatUSD(0)).toBe("$0.00");
  });

  it("formats negatives with a leading minus", () => {
    expect(formatUSD(-5)).toBe("-$5.00");
  });
});
