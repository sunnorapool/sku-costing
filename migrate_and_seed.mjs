import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const DB_URL = process.env.DATABASE_URL;
const url = new URL(DB_URL);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
  multipleStatements: true,
});

console.log('Connected. Database:', url.pathname.slice(1));

// Step 1: Add missing columns
console.log('Adding missing columns...');
try {
  await conn.execute(`ALTER TABLE sku_pricing
    ADD COLUMN srp_margin decimal(8,4) DEFAULT NULL,
    ADD COLUMN tariff_pct decimal(8,4) DEFAULT NULL,
    ADD COLUMN tariff_amt decimal(10,2) DEFAULT NULL,
    ADD COLUMN duty_pct decimal(8,4) DEFAULT NULL,
    ADD COLUMN duty_amt decimal(10,2) DEFAULT NULL,
    ADD COLUMN freight decimal(10,2) DEFAULT NULL,
    ADD COLUMN freight_alt decimal(10,2) DEFAULT NULL,
    ADD COLUMN load_pct decimal(8,4) DEFAULT NULL,
    ADD COLUMN bd_license_fee_pct decimal(8,4) DEFAULT NULL,
    ADD COLUMN asia_margin_pct decimal(8,4) DEFAULT NULL,
    ADD COLUMN bd_fee decimal(10,2) DEFAULT NULL,
    ADD COLUMN notes text DEFAULT NULL`);
  console.log('✅ Columns added successfully');
} catch (err) {
  if (err.message.includes('Duplicate column')) {
    console.log('ℹ️  Columns already exist, skipping ALTER');
  } else {
    console.error('❌ ALTER error:', err.message);
    // Try adding one by one
    const newCols = [
      'srp_margin decimal(8,4)', 'tariff_pct decimal(8,4)', 'tariff_amt decimal(10,2)',
      'duty_pct decimal(8,4)', 'duty_amt decimal(10,2)', 'freight decimal(10,2)',
      'freight_alt decimal(10,2)', 'load_pct decimal(8,4)', 'bd_license_fee_pct decimal(8,4)',
      'asia_margin_pct decimal(8,4)', 'bd_fee decimal(10,2)', 'notes text'
    ];
    for (const col of newCols) {
      const colName = col.split(' ')[0];
      try {
        await conn.execute(`ALTER TABLE sku_pricing ADD COLUMN ${col} DEFAULT NULL`);
        console.log(`  ✅ Added ${colName}`);
      } catch (e) {
        if (e.message.includes('Duplicate column') || e.message.includes('already exists')) {
          console.log(`  ℹ️  ${colName} already exists`);
        } else {
          console.error(`  ❌ ${colName}: ${e.message}`);
        }
      }
    }
  }
}

// Verify columns
const [cols] = await conn.execute(
  "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sku_pricing' ORDER BY ORDINAL_POSITION"
);
const colNames = cols.map(c => c.COLUMN_NAME);
console.log(`\nsku_pricing now has ${colNames.length} columns`);
console.log('Has srp_margin:', colNames.includes('srp_margin'));
console.log('Has bd_fee:', colNames.includes('bd_fee'));

// Step 2: Seed data
const records = JSON.parse(readFileSync('/home/ubuntu/sku_records.json', 'utf8'));
console.log(`\nLoaded ${records.length} records to import`);

// Clear existing data
await conn.execute('DELETE FROM sku_versions');
await conn.execute('DELETE FROM sku_pricing');
await conn.execute('DELETE FROM skus');
console.log('Cleared existing data');

let inserted = 0;
let errors = 0;

for (let i = 0; i < records.length; i++) {
  const rec = records[i];
  try {
    const [skuResult] = await conn.execute(
      `INSERT INTO skus (sku, description, product_group, var1, var2, status, sort_order, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())`,
      [rec.sku, rec.description || null, rec.productGroup || null, rec.var1 || null, rec.var2 || null, rec.sortOrder]
    );
    
    const skuId = skuResult.insertId;
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
    if (errors <= 3) console.error(`Error on SKU ${rec.sku}:`, err.message);
  }
  
  if ((i + 1) % 500 === 0 || i + 1 === records.length) {
    console.log(`Progress: ${i + 1}/${records.length} (${inserted} inserted, ${errors} errors)`);
  }
}

await conn.end();
console.log(`\n✅ Done! Inserted ${inserted} SKUs with ${errors} errors.`);
