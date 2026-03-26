import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const records = JSON.parse(readFileSync('/home/ubuntu/sku_records.json', 'utf8'));
console.log(`Loaded ${records.length} records`);

const url = new URL(DB_URL);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
  multipleStatements: false,
});

console.log('Connected to database');

// Clear existing data first
await conn.execute('DELETE FROM sku_versions');
await conn.execute('DELETE FROM sku_pricing');
await conn.execute('DELETE FROM skus');
console.log('Cleared existing data');

let inserted = 0;
let errors = 0;

for (let i = 0; i < records.length; i++) {
  const rec = records[i];
  try {
    // Insert SKU - columns: id, sku, description, product_group, var1, var2, status, sort_order, createdAt, updatedAt
    const [skuResult] = await conn.execute(
      `INSERT INTO skus (sku, description, product_group, var1, var2, status, sort_order, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())`,
      [
        rec.sku,
        rec.description || null,
        rec.productGroup || null,
        rec.var1 || null,
        rec.var2 || null,
        rec.sortOrder,
      ]
    );
    
    const skuId = skuResult.insertId;
    const p = rec.pricing;
    
    // Insert pricing - exact column order from DB:
    // id, sku_id, srp_2023, srp_2024, map, comps_2024, srp_2024_amzn, wholesale_pool_city,
    // bd_wholesale_margin_pct, fob_26_costing, factory_cost, pptg_25_wholesale_price,
    // bd_wholesale_retail_24, bd_wholesale_retail_25, adjusted, inc_24_25_pct,
    // bd_margin, bd_margin_pct, landed_cost, landed_plus_bd_fees, margin,
    // createdAt, updatedAt, srp_margin, tariff_pct, tariff_amt, duty_pct, duty_amt,
    // freight, freight_alt, load_pct, bd_license_fee_pct, asia_margin_pct, bd_fee, notes
    await conn.execute(
      `INSERT INTO sku_pricing (
        sku_id, srp_2023, srp_2024, map, comps_2024, srp_2024_amzn, wholesale_pool_city,
        bd_wholesale_margin_pct, fob_26_costing, factory_cost, pptg_25_wholesale_price,
        bd_wholesale_retail_24, bd_wholesale_retail_25, adjusted, inc_24_25_pct,
        bd_margin, bd_margin_pct, landed_cost, landed_plus_bd_fees, margin,
        srp_margin, tariff_pct, tariff_amt, duty_pct, duty_amt,
        freight, freight_alt, load_pct, bd_license_fee_pct, asia_margin_pct, bd_fee,
        createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        NOW(), NOW()
      )`,
      [
        skuId,
        p.srp2023 ?? null, p.srp2024 ?? null, p.map ?? null, p.comps2024 ?? null,
        p.srp2024Amzn ?? null, p.wholesalePoolCity ?? null,
        p.bdWholesaleMarginPct ?? null, p.fob26Costing ?? null, p.factoryCost ?? null,
        p.pptg25WholesalePrice ?? null,
        p.bdWholesaleRetail24 ?? null, p.bdWholesaleRetail25 ?? null,
        p.adjusted ?? null, p.inc2425Pct ?? null,
        p.bdMargin ?? null, p.bdMarginPct ?? null,
        p.landedCost ?? null, p.landedPlusBdFees ?? null, p.margin ?? null,
        p.srpMargin ?? null, p.tariffPct ?? null, p.tariffAmt ?? null,
        p.dutyPct ?? null, p.dutyAmt ?? null,
        p.freight ?? null, p.freightAlt ?? null, p.loadPct ?? null,
        p.bdLicenseFeePct ?? null, p.asiaMarginPct ?? null, p.bdFee ?? null,
      ]
    );
    
    inserted++;
  } catch (err) {
    errors++;
    if (errors <= 3) {
      console.error(`Error on SKU ${rec.sku}:`, err.message);
    }
  }
  
  if ((i + 1) % 500 === 0 || i + 1 === records.length) {
    console.log(`Progress: ${i + 1}/${records.length} (${inserted} inserted, ${errors} errors)`);
  }
}

await conn.end();
console.log(`\nDone! Inserted ${inserted} SKUs with ${errors} errors.`);
