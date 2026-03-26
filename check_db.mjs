import { createConnection } from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
const url = new URL(DB_URL);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log('Connected. Database:', url.pathname.slice(1));

const [cols] = await conn.execute(
  "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sku_pricing' ORDER BY ORDINAL_POSITION"
);
console.log('sku_pricing columns:');
cols.forEach(c => console.log(' ', c.COLUMN_NAME));

// Test a direct insert
try {
  await conn.execute(
    "INSERT INTO skus (sku, description, status, sort_order, createdAt, updatedAt) VALUES ('TEST_DIAG', 'Test', 'active', 0, NOW(), NOW())"
  );
  const [[row]] = await conn.execute("SELECT id FROM skus WHERE sku = 'TEST_DIAG'");
  const skuId = row.id;
  
  await conn.execute(
    "INSERT INTO sku_pricing (sku_id, srp_margin, createdAt, updatedAt) VALUES (?, 0.5, NOW(), NOW())",
    [skuId]
  );
  console.log('✅ srp_margin insert works!');
  
  await conn.execute("DELETE FROM sku_pricing WHERE sku_id = ?", [skuId]);
  await conn.execute("DELETE FROM skus WHERE sku = 'TEST_DIAG'");
} catch (err) {
  console.error('❌ Error:', err.message);
}

await conn.end();
