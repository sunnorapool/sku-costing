/**
 * Applies the missing sku_pricing columns using the server's DATABASE_URL,
 * then re-seeds all 6,778 SKUs.
 */
import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const url = new URL(DB_URL);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log('Connected to:', url.hostname, '/', url.pathname.slice(1));

// Check current columns
const [cols] = await conn.execute(
  "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sku_pricing' ORDER BY ORDINAL_POSITION"
);
const existing = new Set(cols.map(c => c.COLUMN_NAME));
console.log('Current columns:', existing.size);
console.log('Has srp_margin:', existing.has('srp_margin'));

// Add missing columns one by one
const toAdd = [
  ['srp_margin', 'decimal(8,4)'],
  ['tariff_pct', 'decimal(8,4)'],
  ['tariff_amt', 'decimal(10,2)'],
  ['duty_pct', 'decimal(8,4)'],
  ['duty_amt', 'decimal(10,2)'],
  ['freight', 'decimal(10,2)'],
  ['freight_alt', 'decimal(10,2)'],
  ['load_pct', 'decimal(8,4)'],
  ['bd_license_fee_pct', 'decimal(8,4)'],
  ['asia_margin_pct', 'decimal(8,4)'],
  ['bd_fee', 'decimal(10,2)'],
  ['notes', 'text'],
];

for (const [col, type] of toAdd) {
  if (!existing.has(col)) {
    try {
      await conn.execute(`ALTER TABLE sku_pricing ADD COLUMN ${col} ${type} DEFAULT NULL`);
      console.log(`✅ Added column: ${col}`);
    } catch (e) {
      console.error(`❌ Failed to add ${col}: ${e.message}`);
    }
  } else {
    console.log(`ℹ️  Column already exists: ${col}`);
  }
}

// Verify
const [cols2] = await conn.execute(
  "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sku_pricing' ORDER BY ORDINAL_POSITION"
);
console.log(`\nAfter migration: ${cols2.length} columns in sku_pricing`);
console.log('Has srp_margin:', cols2.some(c => c.COLUMN_NAME === 'srp_margin'));

// Now seed the data
const records = JSON.parse(readFileSync('/home/ubuntu/sku_records.json', 'utf8'));
console.log(`\nSeeding ${records.length} SKUs...`);

// Clear existing
await conn.execute('DELETE FROM sku_versions');
await conn.execute('DELETE FROM sku_pricing');
await conn.execute('DELETE FROM skus');
console.log('Cleared existing data');

let inserted = 0, errors = 0;

for (let i = 0; i < records.length; i++) {
  const rec = records[i];
  try {
    const [r] = await conn.execute(
      `INSERT INTO skus (sku, description, product_group, var1, var2, status, sort_order, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())`,
      [rec.sku, rec.description||null, rec.productGroup||null, rec.var1||null, rec.var2||null, rec.sortOrder]
    );
    const skuId = r.insertId;
    const p = rec.pricing;
    await conn.execute(
      `INSERT INTO sku_pricing (
        sku_id, srp_2023, srp_2024, map, comps_2024, srp_2024_amzn, wholesale_pool_city,
        bd_wholesale_margin_pct, fob_26_costing, factory_cost, pptg_25_wholesale_price,
        bd_wholesale_retail_24, bd_wholesale_retail_25, adjusted, inc_24_25_pct,
        bd_margin, bd_margin_pct, landed_cost, landed_plus_bd_fees, margin,
        srp_margin, tariff_pct, tariff_amt, duty_pct, duty_amt,
        freight, freight_alt, load_pct, bd_license_fee_pct, asia_margin_pct, bd_fee,
        createdAt, updatedAt
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        skuId,
        p.srp2023??null, p.srp2024??null, p.map??null, p.comps2024??null, p.srp2024Amzn??null, p.wholesalePoolCity??null,
        p.bdWholesaleMarginPct??null, p.fob26Costing??null, p.factoryCost??null, p.pptg25WholesalePrice??null,
        p.bdWholesaleRetail24??null, p.bdWholesaleRetail25??null, p.adjusted??null, p.inc2425Pct??null,
        p.bdMargin??null, p.bdMarginPct??null, p.landedCost??null, p.landedPlusBdFees??null, p.margin??null,
        p.srpMargin??null, p.tariffPct??null, p.tariffAmt??null, p.dutyPct??null, p.dutyAmt??null,
        p.freight??null, p.freightAlt??null, p.loadPct??null, p.bdLicenseFeePct??null, p.asiaMarginPct??null, p.bdFee??null,
      ]
    );
    inserted++;
  } catch (err) {
    errors++;
    if (errors <= 3) console.error(`Error on ${rec.sku}:`, err.message);
  }
  if ((i+1) % 1000 === 0 || i+1 === records.length) {
    console.log(`Progress: ${i+1}/${records.length} (${inserted} ok, ${errors} errors)`);
  }
}

await conn.end();
console.log(`\n✅ Done! ${inserted} SKUs inserted, ${errors} errors.`);
