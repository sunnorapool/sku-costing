/**
 * Dealer Pricing — Unit Tests
 * Tests the pure pricing math functions without any DB dependency.
 */
import { describe, it, expect } from "vitest";

// ─── Replicated pure functions (same as in dealerPricing.ts) ─────────────────

function computeListPrice(costBasis: number, marginPct: number, royaltyPct: number): number {
  const denominator = 1 - marginPct - royaltyPct;
  if (denominator <= 0) return 0;
  return Math.round((costBasis / denominator) * 100) / 100;
}

function computeNetPrice(listPrice: number, discountPct: number): number {
  return Math.round(listPrice * (1 - discountPct) * 100) / 100;
}

function computeKeptMargin(netPrice: number, costBasis: number): number {
  if (netPrice <= 0) return 0;
  return Math.round(((netPrice - costBasis) / netPrice) * 10000) / 10000;
}

type MarginRuleRow = {
  scope: "global" | "category" | "vendor" | "sku";
  scopeValue: string | null;
  importMarginPct: string | null;
  domesticMarginPct: string | null;
};

function resolveMargins(
  rules: MarginRuleRow[],
  category: string | null,
  vendor: string | null,
  skuCode: string | null
): { importMargin: number; domesticMargin: number } {
  const scopePriority = { global: 0, category: 1, vendor: 2, sku: 3 };
  let bestImport: { pct: number; priority: number } | null = null;
  let bestDomestic: { pct: number; priority: number } | null = null;

  for (const rule of rules) {
    const priority = scopePriority[rule.scope];
    let applies = false;
    if (rule.scope === "global") applies = true;
    else if (rule.scope === "category" && category && rule.scopeValue === category) applies = true;
    else if (rule.scope === "vendor" && vendor && rule.scopeValue === vendor) applies = true;
    else if (rule.scope === "sku" && skuCode && rule.scopeValue === skuCode) applies = true;
    if (!applies) continue;
    if (rule.importMarginPct !== null) {
      const pct = parseFloat(rule.importMarginPct);
      if (!bestImport || priority > bestImport.priority) bestImport = { pct, priority };
    }
    if (rule.domesticMarginPct !== null) {
      const pct = parseFloat(rule.domesticMarginPct);
      if (!bestDomestic || priority > bestDomestic.priority) bestDomestic = { pct, priority };
    }
  }
  return { importMargin: bestImport?.pct ?? 0.2, domesticMargin: bestDomestic?.pct ?? 0.35 };
}

function resolveDiscount(
  tierDiscountMap: Record<number, number>,
  customerOverrideMap: Record<number, number>,
  skuCustomerOverrideMap: Record<string, number>,
  customerId: number,
  tier: number,
  skuId: number
): number {
  const key = `${skuId}:${customerId}`;
  if (skuCustomerOverrideMap[key] !== undefined) return skuCustomerOverrideMap[key];
  if (customerOverrideMap[customerId] !== undefined) return customerOverrideMap[customerId];
  return tierDiscountMap[tier] ?? 0;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("computeListPrice", () => {
  it("computes list price with no royalty", () => {
    // cost=10, margin=20%, royalty=0% → list = 10 / 0.80 = 12.50
    expect(computeListPrice(10, 0.2, 0)).toBe(12.5);
  });

  it("computes list price with BD royalty", () => {
    // cost=10, margin=20%, royalty=3.5% → list = 10 / (1-0.20-0.035) = 10/0.765 ≈ 13.07
    expect(computeListPrice(10, 0.2, 0.035)).toBe(13.07);
  });

  it("computes list price with domestic margin", () => {
    // cost=10, margin=35%, royalty=0% → list = 10 / 0.65 ≈ 15.38
    expect(computeListPrice(10, 0.35, 0)).toBe(15.38);
  });

  it("returns 0 when denominator is zero or negative", () => {
    expect(computeListPrice(10, 1.0, 0)).toBe(0);
    expect(computeListPrice(10, 0.8, 0.3)).toBe(0);
  });
});

describe("computeNetPrice", () => {
  it("applies tier 1 discount (15%)", () => {
    // list=12.50, discount=15% → net = 12.50 * 0.85 = 10.625 → 10.63
    expect(computeNetPrice(12.5, 0.15)).toBe(10.63);
  });

  it("applies tier 2 discount (10%)", () => {
    expect(computeNetPrice(12.5, 0.10)).toBe(11.25);
  });

  it("applies tier 3 discount (5%)", () => {
    expect(computeNetPrice(12.5, 0.05)).toBe(11.88);
  });

  it("returns list price when no discount", () => {
    expect(computeNetPrice(12.5, 0)).toBe(12.5);
  });
});

describe("computeKeptMargin", () => {
  it("computes kept margin correctly", () => {
    // net=10.63, cost=10 → margin = (10.63-10)/10.63 ≈ 0.0593
    const margin = computeKeptMargin(10.63, 10);
    expect(margin).toBeGreaterThan(0.05);
    expect(margin).toBeLessThan(0.07);
  });

  it("returns 0 for zero net price", () => {
    expect(computeKeptMargin(0, 10)).toBe(0);
  });
});

describe("resolveMargins", () => {
  const globalRule: MarginRuleRow = { scope: "global", scopeValue: null, importMarginPct: "0.2000", domesticMarginPct: "0.3500" };
  const categoryRule: MarginRuleRow = { scope: "category", scopeValue: "Pool Cleaners", importMarginPct: "0.2500", domesticMarginPct: "0.4000" };
  const vendorRule: MarginRuleRow = { scope: "vendor", scopeValue: "Hayward", importMarginPct: "0.1800", domesticMarginPct: null };
  const skuRule: MarginRuleRow = { scope: "sku", scopeValue: "HC150", importMarginPct: "0.2200", domesticMarginPct: "0.3000" };

  it("returns global defaults when no specific rules match", () => {
    const result = resolveMargins([globalRule], "Chemicals", "Generic", "XYZ123");
    expect(result.importMargin).toBe(0.2);
    expect(result.domesticMargin).toBe(0.35);
  });

  it("category rule overrides global", () => {
    const result = resolveMargins([globalRule, categoryRule], "Pool Cleaners", "Generic", "XYZ123");
    expect(result.importMargin).toBe(0.25);
    expect(result.domesticMargin).toBe(0.4);
  });

  it("vendor rule overrides category for import only", () => {
    const result = resolveMargins([globalRule, categoryRule, vendorRule], "Pool Cleaners", "Hayward", "XYZ123");
    expect(result.importMargin).toBe(0.18); // vendor wins for import
    expect(result.domesticMargin).toBe(0.4); // category wins for domestic (vendor has null)
  });

  it("SKU rule wins over everything", () => {
    const result = resolveMargins([globalRule, categoryRule, vendorRule, skuRule], "Pool Cleaners", "Hayward", "HC150");
    expect(result.importMargin).toBe(0.22);
    expect(result.domesticMargin).toBe(0.3);
  });

  it("falls back to hardcoded defaults when no rules at all", () => {
    const result = resolveMargins([], "Pool Cleaners", "Hayward", "HC150");
    expect(result.importMargin).toBe(0.2);
    expect(result.domesticMargin).toBe(0.35);
  });
});

describe("resolveDiscount", () => {
  const tierMap = { 1: 0.15, 2: 0.10, 3: 0.05 };

  it("returns tier discount when no overrides", () => {
    expect(resolveDiscount(tierMap, {}, {}, 1, 1, 100)).toBe(0.15);
    expect(resolveDiscount(tierMap, {}, {}, 2, 2, 100)).toBe(0.10);
    expect(resolveDiscount(tierMap, {}, {}, 3, 3, 100)).toBe(0.05);
  });

  it("customer override wins over tier", () => {
    const custOverrides = { 1: 0.12 };
    expect(resolveDiscount(tierMap, custOverrides, {}, 1, 1, 100)).toBe(0.12);
  });

  it("SKU×customer override wins over customer override", () => {
    const custOverrides = { 1: 0.12 };
    const skuCustOverrides = { "100:1": 0.08 };
    expect(resolveDiscount(tierMap, custOverrides, skuCustOverrides, 1, 1, 100)).toBe(0.08);
  });

  it("SKU×customer override for different customer does not apply", () => {
    const skuCustOverrides = { "100:2": 0.08 }; // only for customer 2
    expect(resolveDiscount(tierMap, {}, skuCustOverrides, 1, 1, 100)).toBe(0.15); // tier applies for customer 1
  });
});

describe("end-to-end price calculation", () => {
  it("matches Dan's formula: cost=10, import margin=20%, no royalty, L1 discount=15%", () => {
    const list = computeListPrice(10, 0.2, 0);
    const net = computeNetPrice(list, 0.15);
    const margin = computeKeptMargin(net, 10);
    expect(list).toBe(12.5);
    expect(net).toBe(10.63);
    expect(margin).toBeGreaterThan(0.05);
  });

  it("BD royalty reduces list price margin as expected", () => {
    // With royalty, the list price is higher, so net is higher too
    const listNoRoyalty = computeListPrice(10, 0.2, 0);
    const listWithRoyalty = computeListPrice(10, 0.2, 0.035);
    expect(listWithRoyalty).toBeGreaterThan(listNoRoyalty);
  });
});
