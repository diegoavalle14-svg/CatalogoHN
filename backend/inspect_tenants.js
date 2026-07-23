const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/config/database');

async function main() {
  try {
    const res = await db.query('SELECT id, nombre, subnombre, slug FROM empresas ORDER BY id DESC LIMIT 5');
    console.log('Last 5 tenants:', res.rows);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.pool.end();
  }
}

main();
