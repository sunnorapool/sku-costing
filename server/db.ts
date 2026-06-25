import { and, desc, eq, ilike, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertSku, InsertSkuPricing, InsertSkuVersion, skuPricing, skuVersions, skus, users } from "../drizzle/schema";
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
