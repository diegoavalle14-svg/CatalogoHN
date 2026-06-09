const db = require('../config/database');

let productInventoryColumnsReady = false;
let categoryImageColumnReady = false;
let priceVisibilityColumnReady = false;

async function ensureProductInventoryColumns(client = db) {
  if (productInventoryColumnsReady) return;
  await client.query(`ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_actual INT NOT NULL DEFAULT 0`);
  await client.query(`ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_minimo INT NOT NULL DEFAULT 0`);
  productInventoryColumnsReady = true;
}

async function ensureCategoryImageColumn(client = db) {
  if (categoryImageColumnReady) return;
  await client.query(`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS imagen_url TEXT`);
  categoryImageColumnReady = true;
}

async function ensurePriceVisibilityColumn(client = db) {
  if (priceVisibilityColumnReady) return;
  await client.query(`ALTER TABLE precios ADD COLUMN IF NOT EXISTS visible_cliente BOOLEAN DEFAULT true`);
  priceVisibilityColumnReady = true;
}

module.exports = {
  ensureProductInventoryColumns,
  ensureCategoryImageColumn,
  ensurePriceVisibilityColumn
};
