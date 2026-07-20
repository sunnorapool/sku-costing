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

  // 2027 FOB pricing fields (from Ian's verified database)
  fob2027Price: decimal("fob_2027_price", { precision: 10, scale: 4 }),
  fob2027Status: mysqlEnum("fob_2027_status", ["confirmed", "placeholder", "missing"]),
  fob2027Source: varchar("fob_2027_source", { length: 256 }), // e.g. 'SPLASH 2027 quote', 'legacy avg'

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

// ─── Channel Price History ────────────────────────────────────────────────────

// Audit trail: every time a channel price changes, a row is inserted here
export const channelPriceHistory = mysqlTable("channel_price_history", {
  id: int("id").autoincrement().primaryKey(),
  skuId: int("sku_id").notNull(),
  channelId: int("channel_id").notNull(),

  // Snapshot of old and new values
  oldPrice: decimal("old_price", { precision: 10, scale: 2 }),
  newPrice: decimal("new_price", { precision: 10, scale: 2 }),
  oldMarginPct: decimal("old_margin_pct", { precision: 8, scale: 4 }),
  newMarginPct: decimal("new_margin_pct", { precision: 8, scale: 4 }),
  oldFloorPrice: decimal("old_floor_price", { precision: 10, scale: 2 }),
  newFloorPrice: decimal("new_floor_price", { precision: 10, scale: 2 }),
  oldCeilingPrice: decimal("old_ceiling_price", { precision: 10, scale: 2 }),
  newCeilingPrice: decimal("new_ceiling_price", { precision: 10, scale: 2 }),

  changeSource: varchar("change_source", { length: 64 }).default("manual"), // manual | bulk_import | apply_rule
  notes: text("notes"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

export type ChannelPriceHistory = typeof channelPriceHistory.$inferSelect;
export type InsertChannelPriceHistory = typeof channelPriceHistory.$inferInsert;

// ─── Dealer Pricing (2027 Model) ──────────────────────────────────────────────

// Global config key-value store (pricing_basis, pricing_mode, etc.)
export const pricingConfig = mysqlTable("pricing_config", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PricingConfig = typeof pricingConfig.$inferSelect;
export type InsertPricingConfig = typeof pricingConfig.$inferInsert;

// Margin rules: global → category → vendor → sku (most specific wins)
export const dealerMarginRules = mysqlTable("dealer_margin_rules", {
  id: int("id").autoincrement().primaryKey(),
  scope: mysqlEnum("scope", ["global", "category", "vendor", "sku"]).notNull(),
  scopeValue: varchar("scope_value", { length: 256 }), // null for global; category name, vendor name, or sku code otherwise
  importMarginPct: decimal("import_margin_pct", { precision: 8, scale: 4 }), // e.g. 0.2000 = 20%
  domesticMarginPct: decimal("domestic_margin_pct", { precision: 8, scale: 4 }), // e.g. 0.3500 = 35%
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DealerMarginRule = typeof dealerMarginRules.$inferSelect;
export type InsertDealerMarginRule = typeof dealerMarginRules.$inferInsert;

// Buyer tier discount schedules (L1/L2/L3)
export const tierDiscounts = mysqlTable("tier_discounts", {
  id: int("id").autoincrement().primaryKey(),
  tier: int("tier").notNull(), // 1, 2, or 3
  discountPct: decimal("discount_pct", { precision: 8, scale: 4 }).notNull(), // e.g. 0.1500 = 15%
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TierDiscount = typeof tierDiscounts.$inferSelect;
export type InsertTierDiscount = typeof tierDiscounts.$inferInsert;

// Dealer customers with tier assignment
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull().unique(),
  tier: int("tier").notNull().default(3), // 1, 2, or 3
  sales2025_26: decimal("sales_2025_26", { precision: 14, scale: 2 }), // for reference
  importDepositException: int("import_deposit_exception").default(0), // 1 = exception to 50% deposit rule
  notes: text("notes"),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// Customer-level discount override (overrides tier default for this customer)
export const customerDiscountOverrides = mysqlTable("customer_discount_overrides", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customer_id").notNull(),
  discountPct: decimal("discount_pct", { precision: 8, scale: 4 }).notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerDiscountOverride = typeof customerDiscountOverrides.$inferSelect;
export type InsertCustomerDiscountOverride = typeof customerDiscountOverrides.$inferInsert;

// SKU-level discount override for a specific customer (most specific wins)
export const skuDiscountOverrides = mysqlTable("sku_discount_overrides", {
  id: int("id").autoincrement().primaryKey(),
  skuId: int("sku_id").notNull(),
  customerId: int("customer_id").notNull(),
  discountPct: decimal("discount_pct", { precision: 8, scale: 4 }).notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SkuDiscountOverride = typeof skuDiscountOverrides.$inferSelect;
export type InsertSkuDiscountOverride = typeof skuDiscountOverrides.$inferInsert;

// Manual price overrides (bypass the computed price entirely for a SKU × customer)
export const dealerPriceOverrides = mysqlTable("dealer_price_overrides", {
  id: int("id").autoincrement().primaryKey(),
  skuId: int("sku_id").notNull(),
  customerId: int("customer_id").notNull(),
  importListOverride: decimal("import_list_override", { precision: 10, scale: 2 }),
  domesticListOverride: decimal("domestic_list_override", { precision: 10, scale: 2 }),
  importNetOverride: decimal("import_net_override", { precision: 10, scale: 2 }),
  domesticNetOverride: decimal("domestic_net_override", { precision: 10, scale: 2 }),
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DealerPriceOverride = typeof dealerPriceOverrides.$inferSelect;
export type InsertDealerPriceOverride = typeof dealerPriceOverrides.$inferInsert;

// Password-protected locks for supply side (costs/margins) and buy side (discounts/net prices)
export const pricingLocks = mysqlTable("pricing_locks", {
  id: int("id").autoincrement().primaryKey(),
  scope: mysqlEnum("scope", ["supply", "buy"]).notNull().unique(),
  locked: int("locked").default(0).notNull(), // 0 = unlocked, 1 = locked
  passwordHash: varchar("password_hash", { length: 256 }), // bcrypt hash
  lockedAt: timestamp("locked_at"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PricingLock = typeof pricingLocks.$inferSelect;
export type InsertPricingLock = typeof pricingLocks.$inferInsert;

// HTS tariff rate lookup table — one row per HTS code
export const htsTariffRates = mysqlTable("hts_tariff_rates", {
  id: int("id").autoincrement().primaryKey(),
  htsCode: varchar("hts_code", { length: 32 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  baseDutyPct: decimal("base_duty_pct", { precision: 8, scale: 4 }).default("0"), // standard HTS duty %
  sec301Pct: decimal("sec301_pct", { precision: 8, scale: 4 }).default("0"),      // Section 301 China tariff %
  sec232Pct: decimal("sec232_pct", { precision: 8, scale: 4 }).default("0"),      // Section 232 steel/aluminum %
  sec122Pct: decimal("sec122_pct", { precision: 8, scale: 4 }).default("0"),      // Section 122 additional tariff %
  sourceUrl: varchar("source_url", { length: 512 }),                              // link to USTR/CBP source
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type HtsTariffRate = typeof htsTariffRates.$inferSelect;
export type InsertHtsTariffRate = typeof htsTariffRates.$inferInsert;

// Freight & import config — all rate inputs for the landed cost formula
// Each row is a named config key with its value, formula description, and source
export const freightConfig = mysqlTable("freight_config", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: decimal("value", { precision: 12, scale: 6 }).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  unit: varchar("unit", { length: 32 }),           // e.g. "% of FOB", "$/cu ft", "$/container"
  formulaNote: text("formula_note"),               // human-readable formula explanation
  sourceNote: text("source_note"),                 // where this number came from
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type FreightConfig = typeof freightConfig.$inferSelect;
export type InsertFreightConfig = typeof freightConfig.$inferInsert;

// Price snapshots — point-in-time freeze of supply side or buy side computed data
export const priceSnapshots = mysqlTable("price_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 128 }).notNull(),
  scope: mysqlEnum("scope", ["supply", "buy"]).notNull(),
  snapshotData: text("snapshot_data").notNull(), // JSON blob of computed prices at time of snapshot
  skuCount: int("sku_count").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PriceSnapshot = typeof priceSnapshots.$inferSelect;
export type InsertPriceSnapshot = typeof priceSnapshots.$inferInsert;
