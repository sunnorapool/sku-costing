import {
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Status flags matching the spreadsheet rows 1-4 pattern
export const skus = mysqlTable("skus", {
  id: int("id").autoincrement().primaryKey(),
  sku: varchar("sku", { length: 64 }).notNull().unique(),
  description: text("description"),
  productGroup: varchar("product_group", { length: 128 }),
  var1: varchar("var1", { length: 128 }), // e.g. HP, BTU rating
  var2: varchar("var2", { length: 128 }), // e.g. speed, cord type
  status: mysqlEnum("status", ["active", "done", "new_model", "missing", "discontinued"]).default("active").notNull(),
  sortOrder: int("sort_order").default(0),

  // Asia sourcing fields
  supplier: varchar("supplier", { length: 128 }),
  htsCode: varchar("hts_code", { length: 32 }),
  sourceStatus: varchar("source_status", { length: 128 }), // e.g. Ready for costing, Needs packaging
  isBd: varchar("is_bd", { length: 8 }), // Yes/No — Black & Decker branded

  // Sales data (2024-2026 YTD)
  salesQty2024Ytd: decimal("sales_qty_2024_ytd", { precision: 14, scale: 2 }),
  avgPrice2024Ytd: decimal("avg_price_2024_ytd", { precision: 10, scale: 4 }),
  salesAmt2024Ytd: decimal("sales_amt_2024_ytd", { precision: 14, scale: 2 }),

  // Carton / shipping dimensions
  cartonL: decimal("carton_l", { precision: 8, scale: 2 }),  // cm
  cartonW: decimal("carton_w", { precision: 8, scale: 2 }),  // cm
  cartonH: decimal("carton_h", { precision: 8, scale: 2 }),  // cm
  grossWtKg: decimal("gross_wt_kg", { precision: 8, scale: 3 }),
  netWtKg: decimal("net_wt_kg", { precision: 8, scale: 3 }),
  pcsPerCarton: decimal("pcs_per_carton", { precision: 8, scale: 2 }),
  grossWtPerUnit: decimal("gross_wt_per_unit", { precision: 8, scale: 3 }),
  netWtPerUnit: decimal("net_wt_per_unit", { precision: 8, scale: 3 }),
  packingType: varchar("packing_type", { length: 64 }),
  cartonCount: int("carton_count"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sku = typeof skus.$inferSelect;
export type InsertSku = typeof skus.$inferInsert;

// All pricing and cost columns from the spreadsheet
export const skuPricing = mysqlTable("sku_pricing", {
  id: int("id").autoincrement().primaryKey(),
  skuId: int("sku_id").notNull(),

  // Historical SRP pricing
  srp2023: decimal("srp_2023", { precision: 10, scale: 2 }),
  srp2024: decimal("srp_2024", { precision: 10, scale: 2 }),

  // MAP and competitive pricing
  map: decimal("map", { precision: 10, scale: 2 }),
  comps2024: decimal("comps_2024", { precision: 10, scale: 2 }),
  srp2024Amzn: decimal("srp_2024_amzn", { precision: 10, scale: 2 }),

  // Wholesale pricing
  wholesalePoolCity: decimal("wholesale_pool_city", { precision: 10, scale: 2 }),
  bdWholesaleMarginPct: decimal("bd_wholesale_margin_pct", { precision: 8, scale: 4 }),

  // Cost data
  fob26Costing: decimal("fob_26_costing", { precision: 10, scale: 2 }),
  factoryCost: decimal("factory_cost", { precision: 10, scale: 2 }),

  // PPTG pricing
  pptg25WholesalePrice: decimal("pptg_25_wholesale_price", { precision: 10, scale: 2 }),

  // BD wholesale retail prices
  bdWholesaleRetail24: decimal("bd_wholesale_retail_24", { precision: 10, scale: 2 }),
  bdWholesaleRetail25: decimal("bd_wholesale_retail_25", { precision: 10, scale: 2 }),

  // Adjusted and YoY
  adjusted: decimal("adjusted", { precision: 10, scale: 2 }),
  inc2425Pct: decimal("inc_24_25_pct", { precision: 8, scale: 4 }),

  // Margin calculations
  bdMargin: decimal("bd_margin", { precision: 10, scale: 2 }),
  bdMarginPct: decimal("bd_margin_pct", { precision: 8, scale: 4 }),

  // Landed costs
  landedCost: decimal("landed_cost", { precision: 10, scale: 2 }),
  landedPlusBdFees: decimal("landed_plus_bd_fees", { precision: 10, scale: 2 }),

  // Final margin
  margin: decimal("margin", { precision: 10, scale: 2 }),
  srpMargin: decimal("srp_margin", { precision: 10, scale: 2 }),

  // Tariff & Duty
  tariffPct: decimal("tariff_pct", { precision: 8, scale: 4 }),
  tariffAmt: decimal("tariff_amt", { precision: 10, scale: 2 }),
  dutyPct: decimal("duty_pct", { precision: 8, scale: 4 }),
  dutyAmt: decimal("duty_amt", { precision: 10, scale: 2 }),

  // Freight
  freight: decimal("freight", { precision: 10, scale: 2 }),
  freightAlt: decimal("freight_alt", { precision: 10, scale: 2 }),

  // Load & Fees
  loadPct: decimal("load_pct", { precision: 8, scale: 4 }),
  bdLicenseFeePct: decimal("bd_license_fee_pct", { precision: 8, scale: 4 }),
  asiaMarginPct: decimal("asia_margin_pct", { precision: 8, scale: 4 }),
  bdFee: decimal("bd_fee", { precision: 10, scale: 2 }),

  // Notes
  notes: text("notes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SkuPricing = typeof skuPricing.$inferSelect;
export type InsertSkuPricing = typeof skuPricing.$inferInsert;

// Per-SKU version history - tracks individual SKU changes
export const skuVersions = mysqlTable("sku_versions", {
  id: int("id").autoincrement().primaryKey(),
  skuId: int("sku_id").notNull(),
  userId: int("user_id"), // null for AI/system changes
  changeType: mysqlEnum("change_type", ["create", "update", "delete", "ai_prompt", "import", "revert"]).notNull(),
  changeDescription: text("change_description"),
  promptText: text("prompt_text"),
  previousData: json("previous_data"),
  newData: json("new_data"),
  affectedSkuIds: json("affected_sku_ids"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SkuVersion = typeof skuVersions.$inferSelect;
export type InsertSkuVersion = typeof skuVersions.$inferInsert;

// Global version snapshots - captures the full state of all SKUs at a point in time
export const globalVersions = mysqlTable("global_versions", {
  id: int("id").autoincrement().primaryKey(),
  versionName: varchar("version_name", { length: 256 }),
  userId: int("user_id"),
  userName: varchar("user_name", { length: 256 }),
  changeType: mysqlEnum("change_type", ["manual_edit", "ai_prompt", "bulk_import", "restore"]).default("manual_edit").notNull(),
  changeDescription: text("change_description"),
  promptText: text("prompt_text"),
  affectedCount: int("affected_count").default(0),
  snapshotData: json("snapshot_data"),
  affectedSkuIds: json("affected_sku_ids"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GlobalVersion = typeof globalVersions.$inferSelect;
export type InsertGlobalVersion = typeof globalVersions.$inferInsert;

// ─── Channel Pricing ─────────────────────────────────────────────────────────

// Sales channels: online storefronts and wholesale partners
export const channels = mysqlTable("channels", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  type: mysqlEnum("type", ["online", "wholesale"]).notNull(),
  sortOrder: int("sort_order").default(0),
  active: int("active").default(1).notNull(), // 1 = active, 0 = inactive
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Channel = typeof channels.$inferSelect;
export type InsertChannel = typeof channels.$inferInsert;

// Per-SKU price for each channel
export const channelPrices = mysqlTable("channel_prices", {
  id: int("id").autoincrement().primaryKey(),
  skuId: int("sku_id").notNull(),
  channelId: int("channel_id").notNull(),

  // The actual selling price for this channel
  price: decimal("price", { precision: 10, scale: 2 }),

  // Guardrails
  floorPrice: decimal("floor_price", { precision: 10, scale: 2 }),
  ceilingPrice: decimal("ceiling_price", { precision: 10, scale: 2 }),

  // Target margin drives rule-based pricing
  targetMarginPct: decimal("target_margin_pct", { precision: 8, scale: 4 }),

  // Calculated margin (price - landedCost) / price — stored for fast reads
  marginPct: decimal("margin_pct", { precision: 8, scale: 4 }),
  marginAmt: decimal("margin_amt", { precision: 10, scale: 2 }),

  // Competitive research
  competitorPrice: decimal("competitor_price", { precision: 10, scale: 2 }),
  competitorUrl: text("competitor_url"),

  // Free-form notes
  notes: text("notes"),

  effectiveDate: timestamp("effective_date"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChannelPrice = typeof channelPrices.$inferSelect;
export type InsertChannelPrice = typeof channelPrices.$inferInsert;

// ─── Carton Details ───────────────────────────────────────────────────────────

export const cartonDetails = mysqlTable("carton_details", {
  id: int("id").autoincrement().primaryKey(),
  skuId: int("sku_id").notNull(),
  cartonNum: decimal("carton_num", { precision: 6, scale: 1 }),
  cartonLabel: varchar("carton_label", { length: 256 }),
  componentSku: varchar("component_sku", { length: 64 }),
  qtyPerParent: decimal("qty_per_parent", { precision: 8, scale: 2 }),
  componentSellable: varchar("component_sellable", { length: 8 }), // Yes/No
  packRuleStatus: varchar("pack_rule_status", { length: 128 }),
  cartonL: decimal("carton_l", { precision: 8, scale: 2 }),
  cartonW: decimal("carton_w", { precision: 8, scale: 2 }),
  cartonH: decimal("carton_h", { precision: 8, scale: 2 }),
  grossWtKg: decimal("gross_wt_kg", { precision: 8, scale: 3 }),
  netWtKg: decimal("net_wt_kg", { precision: 8, scale: 3 }),
  pcsPerCarton: decimal("pcs_per_carton", { precision: 8, scale: 2 }),
  grossWtPerUnit: decimal("gross_wt_per_unit", { precision: 8, scale: 3 }),
  netWtPerUnit: decimal("net_wt_per_unit", { precision: 8, scale: 3 }),
  packingType: varchar("packing_type", { length: 64 }),
  verifiedBy: varchar("verified_by", { length: 256 }),
  verifiedAt: timestamp("verified_at"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CartonDetail = typeof cartonDetails.$inferSelect;
export type InsertCartonDetail = typeof cartonDetails.$inferInsert;
