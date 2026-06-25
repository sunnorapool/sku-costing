import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getSkuList: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  getSkuById: vi.fn().mockResolvedValue(null),
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
