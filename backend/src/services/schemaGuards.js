const db = require('../config/database');

let productInventoryColumnsReady = false;
let categoryImageColumnReady = false;
let priceVisibilityColumnReady = false;
let branchActiveColumnReady = false;
let pricePromoActiveColumnReady = false;

async function ensureProductInventoryColumns(client = db) {
  if (productInventoryColumnsReady) return;
  await client.query(`ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_actual INT NOT NULL DEFAULT 0`);
  await client.query(`ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_minimo INT NOT NULL DEFAULT 0`);
  productInventoryColumnsReady = true;
}

async function ensureCategoryImageColumn(client = db) {
  if (categoryImageColumnReady) return;
  await client.query(`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS imagen_url TEXT`);
  await client.query(`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS posicion INT DEFAULT 0`);
  categoryImageColumnReady = true;
}

async function ensurePriceVisibilityColumn(client = db) {
  if (priceVisibilityColumnReady) return;
  await client.query(`ALTER TABLE precios ADD COLUMN IF NOT EXISTS visible_cliente BOOLEAN DEFAULT true`);
  priceVisibilityColumnReady = true;
}

async function ensurePricePromoActiveColumn(client = db) {
  if (pricePromoActiveColumnReady) return;
  await client.query(`ALTER TABLE precios ADD COLUMN IF NOT EXISTS promo_activa BOOLEAN DEFAULT false`);
  await client.query(`UPDATE precios SET promo_activa = false WHERE promo_activa IS NULL`);
  pricePromoActiveColumnReady = true;
}

async function ensureBranchActiveColumn(client = db) {
  if (branchActiveColumnReady) return;
  await client.query(`ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true`);
  await client.query(`UPDATE sucursales SET activo = true WHERE activo IS NULL`);
  branchActiveColumnReady = true;
}

module.exports = {
  ensureProductInventoryColumns,
  ensureCategoryImageColumn,
  ensurePriceVisibilityColumn,
  ensurePricePromoActiveColumn,
  ensureBranchActiveColumn
};
