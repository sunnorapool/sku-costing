import { and, desc, eq, ilike, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertSku, InsertSkuPricing, InsertSkuVersion, skuPricing, skuVersions, skus, users, channels, channelPrices, Channel, ChannelPrice, cartonDetails } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── SKUs ─────────────────────────────────────────────────────────────────────

export async function getSkuList(filters?: {
  search?: string;
  productGroup?: string;
  status?: string;
  brand?: string;
  limit?: number;
  offset?: number;
  ids?: number[];
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [];
  if (filters?.search) {
    conditions.push(
      or(
        like(skus.sku, `%${filters.search}%`),
        like(skus.description, `%${filters.search}%`)
      )
    );
  }
  if (filters?.productGroup) {
    conditions.push(eq(skus.productGroup, filters.productGroup));
  }
  if (filters?.status) {
    conditions.push(eq(skus.status, filters.status as any));
  }
  if (filters?.ids && filters.ids.length > 0) {
    conditions.push(inArray(skus.id, filters.ids));
  }
  if (filters?.brand) {
    // Brand is inferred from SKU prefix (e.g. "BD" → BDXBT53) or description
    conditions.push(
      or(
        like(skus.sku, `${filters.brand}%`),
        like(skus.description, `%${filters.brand}%`)
      )
    );
  }
  if ((filters as any)?.sourceStatus) {
    conditions.push(eq(skus.sourceStatus, (filters as any).sourceStatus));
  }
  if ((filters as any)?.supplier) {
    conditions.push(eq(skus.supplier, (filters as any).supplier));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select({
        sku: skus,
        pricing: skuPricing,
      })
      .from(skus)
      .leftJoin(skuPricing, eq(skus.id, skuPricing.skuId))
      .where(where)
      .orderBy(skus.sortOrder, skus.sku)
      .limit(filters?.limit ?? 100)
      .offset(filters?.offset ?? 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(skus)
      .where(where),
  ]);

  return {
    items,
    total: Number(countResult[0]?.count ?? 0),
  };
}

export async function getSkuById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({ sku: skus, pricing: skuPricing })
    .from(skus)
    .leftJoin(skuPricing, eq(skus.id, skuPricing.skuId))
    .where(eq(skus.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function getSkuByCode(skuCode: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({ sku: skus, pricing: skuPricing })
    .from(skus)
    .leftJoin(skuPricing, eq(skus.id, skuPricing.skuId))
    .where(eq(skus.sku, skuCode))
    .limit(1);
  return result[0] ?? null;
}

export async function createSku(
  skuData: InsertSku,
  pricingData?: Omit<InsertSkuPricing, 'id' | 'skuId' | 'createdAt' | 'updatedAt'>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(skus).values(skuData);
  const skuId = (result as any).insertId as number;

  if (pricingData) {
    await db.insert(skuPricing).values({ ...pricingData, skuId });
  } else {
    await db.insert(skuPricing).values({ skuId });
  }

  return getSkuById(skuId);
}

export async function updateSku(
  id: number,
  skuData?: Partial<InsertSku>,
  pricingData?: Partial<InsertSkuPricing>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (skuData && Object.keys(skuData).length > 0) {
    await db.update(skus).set(skuData).where(eq(skus.id, id));
  }

  if (pricingData && Object.keys(pricingData).length > 0) {
    // Check if pricing row exists
    const existing = await db.select({ id: skuPricing.id }).from(skuPricing).where(eq(skuPricing.skuId, id)).limit(1);
    if (existing.length > 0) {
      await db.update(skuPricing).set(pricingData).where(eq(skuPricing.skuId, id));
    } else {
      await db.insert(skuPricing).values({ ...pricingData, skuId: id });
    }
  }

  return getSkuById(id);
}

export async function deleteSku(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(skuPricing).where(eq(skuPricing.skuId, id));
  await db.delete(skuVersions).where(eq(skuVersions.skuId, id));
  await db.delete(skus).where(eq(skus.id, id));
}

export async function getProductGroups() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .selectDistinct({ productGroup: skus.productGroup })
    .from(skus)
    .where(sql`${skus.productGroup} IS NOT NULL`)
    .orderBy(skus.productGroup);
  return result.map(r => r.productGroup).filter(Boolean) as string[];
}

// ─── Bulk update (for AI prompts) ─────────────────────────────────────────────

export async function bulkUpdatePricing(
  skuIds: number[],
  pricingUpdates: Partial<InsertSkuPricing>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (skuIds.length === 0) return;

  await db
    .update(skuPricing)
    .set(pricingUpdates)
    .where(inArray(skuPricing.skuId, skuIds));
}

// ─── Version History ──────────────────────────────────────────────────────────

export async function recordVersion(data: InsertSkuVersion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(skuVersions).values(data);
  return (result as any).insertId as number;
}

export async function getVersionHistory(filters?: {
  skuId?: number;
  search?: string;
  changeType?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [];
  if (filters?.skuId) {
    conditions.push(eq(skuVersions.skuId, filters.skuId));
  }
  if (filters?.changeType) {
    conditions.push(eq(skuVersions.changeType, filters.changeType as any));
  }
  if (filters?.search) {
    const searchLike = `%${filters.search}%`;
    conditions.push(
      or(
        like(skuVersions.changeDescription, searchLike),
        like(skuVersions.promptText, searchLike)
      )
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select({
        version: skuVersions,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        },
      })
      .from(skuVersions)
      .leftJoin(users, eq(skuVersions.userId, users.id))
      .where(where)
      .orderBy(desc(skuVersions.createdAt))
      .limit(filters?.limit ?? 50)
      .offset(filters?.offset ?? 0),
    db.select({ count: sql<number>`count(*)` }).from(skuVersions).where(where),
  ]);

  return {
    items,
    total: Number(countResult[0]?.count ?? 0),
  };
}

// ─── Import helpers ───────────────────────────────────────────────────────────

export async function bulkImportSkus(
  rows: Array<{
    sku: InsertSku;
    pricing: Omit<InsertSkuPricing, 'id' | 'skuId' | 'createdAt' | 'updatedAt'>;
  }>,
  userId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await db.select({ id: skus.id }).from(skus).where(eq(skus.sku, row.sku.sku!)).limit(1);

    if (existing.length > 0) {
      const skuId = existing[0].id;
      // Capture previous state for version history
      const prev = await getSkuById(skuId);
      await updateSku(skuId, row.sku, row.pricing);
      const next = await getSkuById(skuId);
      await recordVersion({
        skuId,
        userId: userId ?? null,
        changeType: 'import',
        changeDescription: `Imported update for SKU ${row.sku.sku}`,
        previousData: prev as any,
        newData: next as any,
        affectedSkuIds: [skuId] as any,
      });
      updated++;
    } else {
      const created_sku = await createSku(row.sku, row.pricing);
      if (created_sku) {
        await recordVersion({
          skuId: created_sku.sku.id,
          userId: userId ?? null,
          changeType: 'import',
          changeDescription: `Imported new SKU ${row.sku.sku}`,
          previousData: null,
          newData: created_sku as any,
          affectedSkuIds: [created_sku.sku.id] as any,
        });
      }
      created++;
    }
  }

  return { created, updated };
}

// ─── Channels ─────────────────────────────────────────────────────────────────────

export async function getChannels(type?: 'online' | 'wholesale'): Promise<Channel[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(channels.active, 1)];
  if (type) conditions.push(eq(channels.type, type));
  return db.select().from(channels).where(and(...conditions)).orderBy(channels.sortOrder);
}

export async function upsertChannel(data: { name: string; type: 'online' | 'wholesale'; sortOrder?: number }): Promise<Channel> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(channels).values({ ...data, active: 1 }).onDuplicateKeyUpdate({ set: { name: data.name, sortOrder: data.sortOrder ?? 0 } });
  const [row] = await db.select().from(channels).where(eq(channels.name, data.name)).limit(1);
  return row;
}

// ─── Channel Prices ──────────────────────────────────────────────────────────────

export async function getChannelPricesBySku(skuId: number): Promise<(ChannelPrice & { channelName: string; channelType: string })[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: channelPrices.id,
      skuId: channelPrices.skuId,
      channelId: channelPrices.channelId,
      price: channelPrices.price,
      floorPrice: channelPrices.floorPrice,
      ceilingPrice: channelPrices.ceilingPrice,
      targetMarginPct: channelPrices.targetMarginPct,
      marginPct: channelPrices.marginPct,
      marginAmt: channelPrices.marginAmt,
      competitorPrice: channelPrices.competitorPrice,
      competitorUrl: channelPrices.competitorUrl,
      notes: channelPrices.notes,
      effectiveDate: channelPrices.effectiveDate,
      createdAt: channelPrices.createdAt,
      updatedAt: channelPrices.updatedAt,
      channelName: channels.name,
      channelType: channels.type,
    })
    .from(channelPrices)
    .innerJoin(channels, eq(channelPrices.channelId, channels.id))
    .where(eq(channelPrices.skuId, skuId));
  return rows as any;
}

export async function getChannelPricesByChannel(
  channelId: number,
  filters?: { search?: string; productGroup?: string; limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [eq(channelPrices.channelId, channelId)];
  const skuConditions = [];
  if (filters?.search) {
    skuConditions.push(or(like(skus.sku, `%${filters.search}%`), like(skus.description, `%${filters.search}%`)));
  }
  if (filters?.productGroup) {
    skuConditions.push(eq(skus.productGroup, filters.productGroup));
  }

  const baseQuery = db
    .select({
      channelPrice: channelPrices,
      sku: skus,
      pricing: skuPricing,
    })
    .from(channelPrices)
    .innerJoin(skus, eq(channelPrices.skuId, skus.id))
    .leftJoin(skuPricing, eq(skuPricing.skuId, skus.id))
    .where(and(...conditions, ...(skuConditions.length ? skuConditions : [])));

  const limit = filters?.limit ?? 100;
  const offset = filters?.offset ?? 0;
  const items = await baseQuery.limit(limit).offset(offset).orderBy(skus.sku);
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(channelPrices)
    .innerJoin(skus, eq(channelPrices.skuId, skus.id))
    .where(and(...conditions, ...(skuConditions.length ? skuConditions : [])));
  return { items, total: Number(countRow?.count ?? 0) };
}

// Matrix: all SKUs (with pricing) + all channel prices for a given channel type
export async function getChannelPricingMatrix(
  channelType: 'online' | 'wholesale',
  filters?: { search?: string; productGroup?: string; supplier?: string; limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) return { skus: [], channels: [], prices: [], total: 0 };

  const channelList = await getChannels(channelType);

  const skuConditions = [];
  if (filters?.search) {
    skuConditions.push(or(like(skus.sku, `%${filters.search}%`), like(skus.description, `%${filters.search}%`)));
  }
  if (filters?.productGroup) {
    skuConditions.push(eq(skus.productGroup, filters.productGroup));
  }
  if (filters?.supplier) {
    skuConditions.push(eq(skus.supplier, filters.supplier));
  }

  const limit = filters?.limit ?? 100;
  const offset = filters?.offset ?? 0;

  const skuRows = await db
    .select({ sku: skus, pricing: skuPricing })
    .from(skus)
    .leftJoin(skuPricing, eq(skuPricing.skuId, skus.id))
    .where(skuConditions.length ? and(...skuConditions) : undefined)
    .orderBy(skus.sku)
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(skus)
    .where(skuConditions.length ? and(...skuConditions) : undefined);

  const skuIds = skuRows.map(r => r.sku.id);
  const channelIds = channelList.map(c => c.id);

  let prices: ChannelPrice[] = [];
  if (skuIds.length > 0 && channelIds.length > 0) {
    prices = await db
      .select()
      .from(channelPrices)
      .where(and(inArray(channelPrices.skuId, skuIds), inArray(channelPrices.channelId, channelIds)));
  }

  return {
    skus: skuRows,
    channels: channelList,
    prices,
    total: Number(countRow?.count ?? 0),
  };
}

export async function upsertChannelPrice(data: {
  skuId: number;
  channelId: number;
  price?: string | null;
  floorPrice?: string | null;
  ceilingPrice?: string | null;
  targetMarginPct?: string | null;
  competitorPrice?: string | null;
  competitorUrl?: string | null;
  notes?: string | null;
  effectiveDate?: Date | null;
  landedCost?: string | null; // used to compute margin
}): Promise<ChannelPrice> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Compute margin if price and landedCost are available
  let marginPct: string | null = null;
  let marginAmt: string | null = null;
  if (data.price && data.landedCost) {
    const p = Number(data.price);
    const l = Number(data.landedCost);
    if (p > 0) {
      marginAmt = (p - l).toFixed(2);
      marginPct = ((p - l) / p).toFixed(4);
    }
  }

  const insertValues = {
    skuId: data.skuId,
    channelId: data.channelId,
    price: data.price ?? null,
    floorPrice: data.floorPrice ?? null,
    ceilingPrice: data.ceilingPrice ?? null,
    targetMarginPct: data.targetMarginPct ?? null,
    marginPct,
    marginAmt,
    competitorPrice: data.competitorPrice ?? null,
    competitorUrl: data.competitorUrl ?? null,
    notes: data.notes ?? null,
    effectiveDate: data.effectiveDate ?? null,
  };

  await db.insert(channelPrices).values(insertValues).onDuplicateKeyUpdate({
    set: {
      price: insertValues.price,
      floorPrice: insertValues.floorPrice,
      ceilingPrice: insertValues.ceilingPrice,
      targetMarginPct: insertValues.targetMarginPct,
      marginPct,
      marginAmt,
      competitorPrice: insertValues.competitorPrice,
      competitorUrl: insertValues.competitorUrl,
      notes: insertValues.notes,
      effectiveDate: insertValues.effectiveDate,
    },
  });

  const [row] = await db
    .select()
    .from(channelPrices)
    .where(and(eq(channelPrices.skuId, data.skuId), eq(channelPrices.channelId, data.channelId)))
    .limit(1);
  return row;
}

export async function applyChannelPricingRule(channelId: number, targetMarginPct: number) {
  // For every SKU that has a landed cost, compute price = landedCost / (1 - targetMarginPct)
  // and upsert the channel price
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const allSkus = await db
    .select({ sku: skus, pricing: skuPricing })
    .from(skus)
    .leftJoin(skuPricing, eq(skuPricing.skuId, skus.id))
    .where(eq(skus.status, 'active'));

  let updated = 0;
  for (const { sku, pricing } of allSkus) {
    const landed = Number(pricing?.landedCost ?? 0);
    if (landed <= 0) continue;
    const price = (landed / (1 - targetMarginPct)).toFixed(2);
    await upsertChannelPrice({
      skuId: sku.id,
      channelId,
      price,
      targetMarginPct: String(targetMarginPct),
      landedCost: String(landed),
    });
    updated++;
  }
  return { updated };
}

export async function exportChannelPriceSheet(
  channelId: number,
  filters?: { productGroup?: string; brand?: string }
) {
  const db = await getDb();
  if (!db) return [];

  const skuConditions = [];
  if (filters?.productGroup) {
    skuConditions.push(eq(skus.productGroup, filters.productGroup));
  }
  if (filters?.brand) {
    // Brand is inferred from SKU prefix or description — match case-insensitively
    skuConditions.push(
      or(
        like(skus.sku, `${filters.brand}%`),
        like(skus.description, `%${filters.brand}%`)
      )
    );
  }

  const rows = await db
    .select({
      sku: skus.sku,
      description: skus.description,
      productGroup: skus.productGroup,
      var1: skus.var1,
      var2: skus.var2,
      status: skus.status,
      landedCost: skuPricing.landedCost,
      srp2024: skuPricing.srp2024,
      map: skuPricing.map,
      channelPrice: channelPrices.price,
      floorPrice: channelPrices.floorPrice,
      ceilingPrice: channelPrices.ceilingPrice,
      targetMarginPct: channelPrices.targetMarginPct,
      marginPct: channelPrices.marginPct,
      marginAmt: channelPrices.marginAmt,
      competitorPrice: channelPrices.competitorPrice,
      notes: channelPrices.notes,
      effectiveDate: channelPrices.effectiveDate,
    })
    .from(channelPrices)
    .innerJoin(skus, eq(channelPrices.skuId, skus.id))
    .leftJoin(skuPricing, eq(skuPricing.skuId, skus.id))
    .where(
      and(
        eq(channelPrices.channelId, channelId),
        ...(skuConditions.length ? skuConditions : [])
      )
    )
    .orderBy(skus.sku);

  return rows;
}

// ─── Carton Details ───────────────────────────────────────────────────────────

export async function getCartonDetailsBySkuId(skuId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cartonDetails)
    .where(eq(cartonDetails.skuId, skuId))
    .orderBy(cartonDetails.cartonNum);
}

export async function getSourceStatuses() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ sourceStatus: skus.sourceStatus })
    .from(skus)
    .where(sql`${skus.sourceStatus} IS NOT NULL AND ${skus.sourceStatus} != ''`);
  return rows.map(r => r.sourceStatus).filter(Boolean).sort() as string[];
}

export async function getSuppliers() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ supplier: skus.supplier })
    .from(skus)
    .where(sql`${skus.supplier} IS NOT NULL AND ${skus.supplier} != ''`);
  return rows.map(r => r.supplier).filter(Boolean).sort() as string[];
}
