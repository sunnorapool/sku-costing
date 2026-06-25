import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getSkuList: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  getSkuById: vi.fn().mockResolvedValue({
    sku: { id: 1, sku: "TEST-001", description: "Test SKU", productGroup: "Test Group", var1: null, var2: null, status: "active", createdAt: new Date(), updatedAt: new Date() },
    pricing: { id: 1, skuId: 1, srp2024: "99.99", map: "79.99", landedCost: "40.00", bdMarginPct: "0.40", createdAt: new Date(), updatedAt: new Date() },
  }),
  createSku: vi.fn().mockResolvedValue({
    sku: { id: 1, sku: "TEST-001", description: "Test SKU", productGroup: "Test Group", var1: null, var2: null, status: "active", createdAt: new Date(), updatedAt: new Date() },
    pricing: { id: 1, skuId: 1, srp2024: "99.99", map: "79.99", landedCost: "40.00", bdMarginPct: "0.40", createdAt: new Date(), updatedAt: new Date() },
  }),
  updateSku: vi.fn().mockResolvedValue({ success: true }),
  deleteSku: vi.fn().mockResolvedValue({ success: true }),
  recordVersion: vi.fn().mockResolvedValue(undefined),
  getVersionHistory: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  bulkImportSkus: vi.fn().mockResolvedValue({ created: 2, updated: 1 }),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getProductGroups: vi.fn().mockResolvedValue(["Heat Pumps", "Above-Ground Pumps"]),
  bulkUpdatePricing: vi.fn().mockResolvedValue({ updated: 0 }),
  // Channel pricing mocks
  getChannels: vi.fn().mockResolvedValue([
    { id: 1, name: "poolpartstogo.com", type: "online", sortOrder: 1, active: 1, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: "Amazon", type: "online", sortOrder: 2, active: 1, createdAt: new Date(), updatedAt: new Date() },
    { id: 5, name: "UAG", type: "wholesale", sortOrder: 1, active: 1, createdAt: new Date(), updatedAt: new Date() },
  ]),
  getChannelPricingMatrix: vi.fn().mockResolvedValue({ skus: [], channels: [], prices: [], total: 0 }),
  getChannelPricesBySku: vi.fn().mockResolvedValue([]),
  upsertChannelPrice: vi.fn().mockResolvedValue({
    id: 1, skuId: 1, channelId: 1, price: "149.99", floorPrice: null, ceilingPrice: null,
    targetMarginPct: "0.35", marginPct: "0.3334", marginAmt: "49.99",
    competitorPrice: null, competitorUrl: null, notes: null, effectiveDate: null,
    createdAt: new Date(), updatedAt: new Date(),
  }),
  applyChannelPricingRule: vi.fn().mockResolvedValue({ updated: 10 }),
}));

// ─── Context helpers ──────────────────────────────────────────────────────────
function makeCtx(role: "admin" | "user" = "admin"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@poolpartstogo.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Auth tests ───────────────────────────────────────────────────────────────
describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.role).toBe("user");
  });
});

// ─── SKU list tests ───────────────────────────────────────────────────────────
describe("skus.list", () => {
  it("returns empty list when no SKUs exist", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.skus.list({});
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.total).toBe(0);
  });

  it("accepts optional filters", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.skus.list({
      search: "heat pump",
      productGroup: "Heat Pumps",
      status: "active",
      limit: 25,
      offset: 0,
    });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
  });
});

// ─── SKU create tests ─────────────────────────────────────────────────────────
describe("skus.create", () => {
  it("creates a SKU when called by admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.skus.create({
      sku: {
        sku: "BDXBT53",
        description: "53K BTU Heat Pump",
        productGroup: "Heat Pumps",
        var1: "53K BTU",
        var2: null,
        status: "active",
      },
      pricing: {
        srp2024: "2699.99",
        map: "2499.99",
        landedCost: "950.00",
      },
    });
    expect(result).toHaveProperty("sku");
    expect(result).toHaveProperty("pricing");
  });

  it("creates a SKU when called by a regular user (open access)", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    const result = await caller.skus.create({
      sku: { sku: "BDXBT53-USER", description: "53K BTU Heat Pump (user)", productGroup: "Heat Pumps" },
    });
    expect(result).toHaveProperty("sku");
  });

  it("creates a SKU when called without authentication (open access)", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.skus.create({
      sku: { sku: "BDXBT53-ANON", description: "53K BTU Heat Pump (anon)", productGroup: "Heat Pumps" },
    });
    expect(result).toHaveProperty("sku");
  });
});

// ─── Version history tests ────────────────────────────────────────────────────
describe("versions.list", () => {
  it("returns version history", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.versions.list({ limit: 10, offset: 0 });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("accepts optional skuId filter", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.versions.list({ skuId: 1, limit: 5 });
    expect(result).toHaveProperty("items");
  });
  it("accepts search filter", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.versions.list({ search: "heat pump", limit: 10 });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
  });
  it("accepts changeType filter", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.versions.list({ changeType: "ai_prompt", limit: 10 });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
  });
});

// ─── Import tests ─────────────────────────────────────────────────────────────
describe("import.csv", () => {
  it("imports rows when called by admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.import.csv({
      rows: [
        { sku: "TEST-001", description: "Test Product 1", productGroup: "Test Group", srp2024: "99.99" },
        { sku: "TEST-002", description: "Test Product 2", productGroup: "Test Group", srp2024: "149.99" },
      ],
    });
    expect(result).toHaveProperty("created");
    expect(result).toHaveProperty("updated");
  });

  it("imports rows when called without authentication (open access)", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.import.csv({
      rows: [{ sku: "TEST-003", description: "Anon import test", productGroup: "Test Group" }],
    });
    expect(result).toHaveProperty("created");
    expect(result).toHaveProperty("updated");
  });
});

// ─── Export tests ─────────────────────────────────────────────────────────────
describe("export.csv", () => {
  it("returns SKU data for export", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.export.csv(undefined);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Margin calculation tests ─────────────────────────────────────────────────
describe("Margin calculations", () => {
  it("calculates BD Margin correctly: Retail - Landed", () => {
    const retail = 2699.99;
    const landed = 950.00;
    const bdMargin = retail - landed;
    expect(bdMargin).toBeCloseTo(1749.99, 2);
  });

  it("calculates BD Margin % correctly: (Retail - Landed) / Retail", () => {
    const retail = 2699.99;
    const landed = 950.00;
    const bdMarginPct = (retail - landed) / retail;
    expect(bdMarginPct).toBeCloseTo(0.6481, 3);
  });

  it("calculates year-over-year increase % correctly", () => {
    const srp2023 = 2499.99;
    const srp2024 = 2699.99;
    const yoyIncrease = (srp2024 - srp2023) / srp2023;
    expect(yoyIncrease).toBeCloseTo(0.08, 2);
  });

  it("handles zero retail price gracefully", () => {
    const retail = 0;
    const landed = 100;
    const bdMarginPct = retail > 0 ? (retail - landed) / retail : 0;
    expect(bdMarginPct).toBe(0);
  });
});

// ─── Channel Pricing tests ────────────────────────────────────────────────────
describe("channels.list", () => {
  it("returns all channels when no type filter", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    // The mock returns [] from db — just verify it resolves without error
    const result = await caller.channels.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("channelPrices.matrix", () => {
  it("returns matrix data for online channels", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.channelPrices.matrix({ channelType: "online", limit: 10, offset: 0 });
    expect(result).toHaveProperty("skus");
    expect(result).toHaveProperty("channels");
    expect(result).toHaveProperty("prices");
    expect(result).toHaveProperty("total");
  });

  it("returns matrix data for wholesale channels", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.channelPrices.matrix({ channelType: "wholesale", limit: 10, offset: 0 });
    expect(result).toHaveProperty("skus");
    expect(Array.isArray(result.channels)).toBe(true);
  });
});

describe("channelPrices.bySku", () => {
  it("returns channel prices for a given SKU", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.channelPrices.bySku({ skuId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("channelPrices.upsert", () => {
  it("upserts a channel price", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.channelPrices.upsert({
      skuId: 1,
      channelId: 1,
      price: "149.99",
      targetMarginPct: "0.35",
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("price");
  });
});

describe("channelPrices.applyRule", () => {
  it("applies a pricing rule to a channel", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.channelPrices.applyRule({ channelId: 1, targetMarginPct: 0.35 });
    expect(result).toHaveProperty("updated");
  });
});

describe("Channel margin calculations", () => {
  it("calculates margin correctly: (price - landed) / price", () => {
    const price = 149.99;
    const landed = 100.00;
    const marginPct = (price - landed) / price;
    expect(marginPct).toBeCloseTo(0.3334, 3);
  });

  it("calculates price from target margin: landed / (1 - margin)", () => {
    const landed = 100.00;
    const targetMargin = 0.35;
    const price = landed / (1 - targetMargin);
    expect(price).toBeCloseTo(153.85, 1);
  });

  it("handles zero landed cost gracefully", () => {
    const price = 149.99;
    const landed = 0;
    const marginPct = landed > 0 ? (price - landed) / price : null;
    expect(marginPct).toBeNull();
  });
});
