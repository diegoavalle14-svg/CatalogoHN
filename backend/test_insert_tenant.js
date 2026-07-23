const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/config/database');

async function main() {
  try {
    const nombre = 'Empresa Prueba';
    const subnombre = 'PRUEBA';
    const safeSlug = 'empresa-prueba';

    const result = await db.query(
      `INSERT INTO empresas (nombre, subnombre, slug, logo_url, color_primario, color_secundario, fuente, activa)
       VALUES ($1, $2, $3, '', '#f0f0f0', '#111111', 'Aptos', true)
       RETURNING id, nombre, subnombre, slug`,
      [nombre, subnombre, safeSlug]
    );
    console.log('Result:', result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.pool.end();
  }
}

main();
