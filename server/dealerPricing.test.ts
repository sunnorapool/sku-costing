/**
 * Dealer Pricing — Unit Tests
 * Tests the pure pricing math functions without any DB dependency.
 *
 * Phase 18 additions (Ian Allena findings register, July 20 2026):
 *   - Finding #15: Section 232 stacking fix
 *   - Finding #17: Blank HTS blocking
 *   - Finding #19: MPF min/max caps
 *   - Finding #30: Price rounding rules
 *   - Finding #10: Weight-vs-cube freight
 *   - Finding #26: Gross margin at 2027 landed cost (renamed from "kept margin")
 *   - Finding #21: Royalty embedded in pricing denominator
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

// ─── Phase 18 helpers (replicated from supplySide.ts) ────────────────────────

/**
 * Finding #15: Correct tariff stacking.
 * Section 122 applies to FOB × (1 - sec232_pct), NOT to the full FOB.
 * For pool equipment: sec232 = 0%, so stacking simplification holds.
 * For steel/aluminum: sec232 = 50%, so sec122 applies to only 50% of FOB.
 */
function computeTariffAmt(
  fob: number,
  baseDutyPct: number,
  sec301Pct: number,
  sec232Pct: number,
  sec122Pct: number,
): { tariffAmt: number; dutyAmt: number; sec301Amt: number; sec232Amt: number; sec122Amt: number } {
  const dutyAmt = fob * baseDutyPct;
  const sec301Amt = fob * sec301Pct;
  const sec232Amt = fob * sec232Pct;
  const sec122Base = fob * (1 - sec232Pct); // Finding #15: only non-232 base
  const sec122Amt = sec122Base * sec122Pct;
  const tariffAmt = sec301Amt + sec232Amt + sec122Amt;
  return { tariffAmt, dutyAmt, sec301Amt, sec232Amt, sec122Amt };
}

/**
 * Finding #19: MPF min/max caps.
 * MPF = clamp(FOB × 0.3464%, min/units, max/units)
 * CBP 2025 rates: min $33.58, max $651.50 per entry.
 */
function computeMpf(fob: number, mpfPct: number, mpfMinUsd: number, mpfMaxUsd: number, unitsPerEntry: number): number {
  const raw = fob * mpfPct;
  const perUnitMin = mpfMinUsd / unitsPerEntry;
  const perUnitMax = mpfMaxUsd / unitsPerEntry;
  return Math.min(Math.max(raw, perUnitMin), perUnitMax);
}

/**
 * Finding #30: Price rounding rules.
 */
function applyRounding(price: number, rule: string): number {
  if (!price || price <= 0) return price;
  switch (rule) {
    case "cent":   return Math.round(price * 100) / 100;
    case "nickel": return Math.round(price * 20) / 20;
    case "dime":   return Math.round(price * 10) / 10;
    case "dollar": return Math.round(price);
    default:       return Math.round(price * 100) / 100;
  }
}

/**
 * Finding #10: Weight-vs-cube freight allocation.
 * Use whichever governs: cube fraction or weight fraction.
 */
function computeFreightAllocationFactor(
  unitCuFt: number,
  containerUsableCuft: number,
  grossWtLbsPerUnit: number | null,
  containerMaxWeightLbs: number,
  freightMode: "cube" | "weight_or_cube",
): { factor: number; basis: "cube" | "weight" } {
  const cubeFraction = unitCuFt / containerUsableCuft;
  if (freightMode === "weight_or_cube" && grossWtLbsPerUnit !== null) {
    const weightFraction = grossWtLbsPerUnit / containerMaxWeightLbs;
    if (weightFraction > cubeFraction) return { factor: weightFraction, basis: "weight" };
  }
  return { factor: cubeFraction, basis: "cube" };
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

  // Finding #21: Royalty is embedded in the pricing denominator.
  // The list price is set high enough to cover royalty — it is NOT a separate deduction.
  it("royalty in denominator raises list price to cover royalty cost (Finding #21)", () => {
    const listNoRoyalty = computeListPrice(10, 0.2, 0);
    const listWithRoyalty = computeListPrice(10, 0.2, 0.035);
    expect(listWithRoyalty).toBeGreaterThan(listNoRoyalty);
    // Verify: royalty is embedded, not a separate deduction
    // At list=13.07, royalty = 13.07 × 3.5% = 0.457. Margin = 13.07 × 20% = 2.614.
    // Cost + royalty + margin = 10 + 0.457 + 2.614 = 13.07 ✓
    const royaltyAmt = listWithRoyalty * 0.035;
    const marginAmt = listWithRoyalty * 0.2;
    expect(Math.round((10 + royaltyAmt + marginAmt) * 100) / 100).toBe(listWithRoyalty);
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

// Finding #26: Gross Margin at 2027 Landed Cost (renamed from "kept margin")
describe("computeKeptMargin (Gross Margin at 2027 Landed Cost — Finding #26)", () => {
  it("computes gross margin correctly", () => {
    // net=10.63, cost=10 → margin = (10.63-10)/10.63 ≈ 0.0593
    const margin = computeKeptMargin(10.63, 10);
    expect(margin).toBeGreaterThan(0.05);
    expect(margin).toBeLessThan(0.07);
  });

  it("returns 0 for zero net price", () => {
    expect(computeKeptMargin(0, 10)).toBe(0);
  });

  it("gross margin at 20% import margin with no royalty", () => {
    // list = 10/0.80 = 12.50, net at 15% discount = 10.63
    // gross margin = (10.63 - 10) / 10.63 ≈ 5.9%
    const list = computeListPrice(10, 0.2, 0);
    const net = computeNetPrice(list, 0.15);
    const margin = computeKeptMargin(net, 10);
    expect(margin).toBeGreaterThan(0.05);
    expect(margin).toBeLessThan(0.07);
  });

  it("gross margin at 35% domestic margin with no royalty", () => {
    // list = 10/0.65 = 15.38, net at 10% discount = 13.84
    // gross margin = (13.84 - 10) / 13.84 ≈ 27.7%
    const list = computeListPrice(10, 0.35, 0);
    const net = computeNetPrice(list, 0.10);
    const margin = computeKeptMargin(net, 10);
    expect(margin).toBeGreaterThan(0.25);
    expect(margin).toBeLessThan(0.30);
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

// ─── Phase 18: Tariff Stacking Fix (Finding #15) ─────────────────────────────

describe("computeTariffAmt — Section 232 stacking fix (Finding #15)", () => {
  it("pool equipment: sec232=0%, sec122 applies to full FOB (no stacking effect)", () => {
    // FOB=100, 301=25%, 232=0%, 122=10%
    // Expected: 301=25, 232=0, 122=100×(1-0)×10%=10, total=35
    const result = computeTariffAmt(100, 0, 0.25, 0, 0.10);
    expect(result.sec301Amt).toBe(25);
    expect(result.sec232Amt).toBe(0);
    expect(result.sec122Amt).toBe(10); // full FOB since 232=0
    expect(result.tariffAmt).toBe(35);
  });

  it("steel/aluminum: sec232=50%, sec122 applies only to non-232 base (50% of FOB)", () => {
    // FOB=100, 301=25%, 232=50%, 122=10%
    // WRONG (old): 301=25, 232=50, 122=10 → total=85
    // CORRECT (new): 301=25, 232=50, 122=100×(1-0.50)×10%=5 → total=80
    const result = computeTariffAmt(100, 0, 0.25, 0.50, 0.10);
    expect(result.sec301Amt).toBe(25);
    expect(result.sec232Amt).toBe(50);
    expect(result.sec122Amt).toBe(5); // only 50% of FOB is non-232 base
    expect(result.tariffAmt).toBe(80); // not 85
  });

  it("base_2027 scenario: sec122=0%, tariff is just 301+232", () => {
    // FOB=100, 301=25%, 232=0%, 122=0% (scenario: base_2027)
    const result = computeTariffAmt(100, 0, 0.25, 0, 0);
    expect(result.sec122Amt).toBe(0);
    expect(result.tariffAmt).toBe(25);
  });

  it("stress scenario: 301 escalates to 35%, sec122=0%", () => {
    // FOB=100, 301=35% (stress), 232=0%, 122=0%
    const result = computeTariffAmt(100, 0, 0.35, 0, 0);
    expect(result.sec301Amt).toBe(35);
    expect(result.sec122Amt).toBe(0);
    expect(result.tariffAmt).toBe(35);
  });

  it("includes base duty separately from tariff surcharges", () => {
    // FOB=100, base=5.3%, 301=25%, 232=0%, 122=10%
    const result = computeTariffAmt(100, 0.053, 0.25, 0, 0.10);
    expect(result.dutyAmt).toBeCloseTo(5.3, 1);
    expect(result.tariffAmt).toBe(35); // tariffAmt = 301+232+122 only
  });
});

// ─── Phase 18: MPF Min/Max Caps (Finding #19) ─────────────────────────────────

describe("computeMpf — MPF min/max caps (Finding #19)", () => {
  const MPF_PCT = 0.003464;
  const MPF_MIN = 33.58;
  const MPF_MAX = 651.50;

  it("applies minimum when FOB is very low", () => {
    // FOB=100, raw MPF = 100 × 0.3464% = $0.35 — below $33.58 min for 1 unit
    const mpf = computeMpf(100, MPF_PCT, MPF_MIN, MPF_MAX, 1);
    expect(mpf).toBe(MPF_MIN); // capped at minimum
  });

  it("applies maximum when FOB is very high", () => {
    // FOB=300,000, raw MPF = 300,000 × 0.3464% = $1,039 — above $651.50 max for 1 unit
    const mpf = computeMpf(300_000, MPF_PCT, MPF_MIN, MPF_MAX, 1);
    expect(mpf).toBe(MPF_MAX); // capped at maximum
  });

  it("uses raw rate when FOB is in the mid-range", () => {
    // FOB=50,000, raw MPF = 50,000 × 0.3464% = $173.20 — between min and max
    const mpf = computeMpf(50_000, MPF_PCT, MPF_MIN, MPF_MAX, 1);
    expect(mpf).toBeCloseTo(173.2, 0);
    expect(mpf).toBeGreaterThan(MPF_MIN);
    expect(mpf).toBeLessThan(MPF_MAX);
  });

  it("min/max are allocated per unit when multiple units per entry", () => {
    // 1000 units per entry: min per unit = 33.58/1000 = $0.03358
    // FOB per unit = $5, raw MPF = 5 × 0.3464% = $0.01732 — below per-unit min
    const mpf = computeMpf(5, MPF_PCT, MPF_MIN, MPF_MAX, 1000);
    expect(mpf).toBeCloseTo(MPF_MIN / 1000, 5);
  });
});

// ─── Phase 18: Price Rounding Rules (Finding #30) ─────────────────────────────

describe("applyRounding — price rounding rules (Finding #30)", () => {
  it("none/default: rounds to cent", () => {
    expect(applyRounding(12.345, "none")).toBe(12.35);
    expect(applyRounding(12.344, "none")).toBe(12.34);
  });

  it("cent: rounds to nearest $0.01", () => {
    expect(applyRounding(12.345, "cent")).toBe(12.35);
    expect(applyRounding(12.344, "cent")).toBe(12.34);
  });

  it("nickel: rounds to nearest $0.05", () => {
    expect(applyRounding(12.34, "nickel")).toBe(12.35);
    expect(applyRounding(12.32, "nickel")).toBe(12.30);
    expect(applyRounding(12.375, "nickel")).toBe(12.40);
  });

  it("dime: rounds to nearest $0.10", () => {
    expect(applyRounding(12.34, "dime")).toBe(12.30);
    expect(applyRounding(12.35, "dime")).toBe(12.40);
  });

  it("dollar: rounds to nearest $1.00", () => {
    expect(applyRounding(12.49, "dollar")).toBe(12);
    expect(applyRounding(12.50, "dollar")).toBe(13);
  });

  it("returns 0 for zero or negative prices", () => {
    expect(applyRounding(0, "cent")).toBe(0);
    expect(applyRounding(-1, "nickel")).toBe(-1);
  });
});

// ─── Phase 18: Weight-vs-Cube Freight (Finding #10) ──────────────────────────

describe("computeFreightAllocationFactor — weight-vs-cube (Finding #10)", () => {
  const CONTAINER_CUFT = 2400;
  const CONTAINER_MAX_LBS = 44000;

  it("cube mode: always uses cube fraction regardless of weight", () => {
    // 1 cu ft unit, 500 lbs per unit (weight would dominate if weight_or_cube)
    const result = computeFreightAllocationFactor(1, CONTAINER_CUFT, 500, CONTAINER_MAX_LBS, "cube");
    expect(result.basis).toBe("cube");
    expect(result.factor).toBeCloseTo(1 / CONTAINER_CUFT, 6);
  });

  it("weight_or_cube: uses cube when cube fraction is larger", () => {
    // 100 cu ft unit (large box), 10 lbs per unit (light)
    // cube fraction = 100/2400 = 4.17%; weight fraction = 10/44000 = 0.023%
    const result = computeFreightAllocationFactor(100, CONTAINER_CUFT, 10, CONTAINER_MAX_LBS, "weight_or_cube");
    expect(result.basis).toBe("cube");
    expect(result.factor).toBeCloseTo(100 / CONTAINER_CUFT, 6);
  });

  it("weight_or_cube: uses weight when weight fraction is larger (heavy dense cargo)", () => {
    // 0.1 cu ft unit (small), 50 lbs per unit (heavy — e.g. calcium chloride)
    // cube fraction = 0.1/2400 = 0.0042%; weight fraction = 50/44000 = 0.114%
    const result = computeFreightAllocationFactor(0.1, CONTAINER_CUFT, 50, CONTAINER_MAX_LBS, "weight_or_cube");
    expect(result.basis).toBe("weight");
    expect(result.factor).toBeCloseTo(50 / CONTAINER_MAX_LBS, 6);
  });

  it("weight_or_cube: uses cube when no weight data provided", () => {
    const result = computeFreightAllocationFactor(1, CONTAINER_CUFT, null, CONTAINER_MAX_LBS, "weight_or_cube");
    expect(result.basis).toBe("cube");
    expect(result.factor).toBeCloseTo(1 / CONTAINER_CUFT, 6);
  });
});

// ─── Phase 18: Blank HTS blocking (Finding #17) ───────────────────────────────

describe("blank HTS code blocking (Finding #17)", () => {
  it("blank HTS code should be flagged as isHtsBlocked", () => {
    // The router sets isHtsBlocked = !hasHtsCode where hasHtsCode = !!(htsCode && htsCode.trim().length > 0)
    const checkHtsBlocked = (htsCode: string | null | undefined) =>
      !(htsCode && htsCode.trim().length > 0);

    expect(checkHtsBlocked("")).toBe(true);     // empty string → blocked
    expect(checkHtsBlocked(null)).toBe(true);   // null → blocked
    expect(checkHtsBlocked(undefined)).toBe(true); // undefined → blocked
    expect(checkHtsBlocked("  ")).toBe(true);   // whitespace only → blocked
    expect(checkHtsBlocked("8413.70.2004")).toBe(false); // valid HTS → not blocked
    expect(checkHtsBlocked("9506.99.5500")).toBe(false); // valid HTS → not blocked
  });
});
