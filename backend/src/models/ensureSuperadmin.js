const bcrypt = require('bcryptjs');
const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const password = process.env.SUPERADMIN_PASSWORD;
const username = String(process.env.SUPERADMIN_USERNAME || 'superadmin').trim();
const email = String(process.env.SUPERADMIN_EMAIL || 'superadmin@catalogohn.com').trim().toLowerCase();
const name = process.env.SUPERADMIN_NAME || 'Super Administrador';

if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

if (!password || password.length < 8) {
  console.error('SUPERADMIN_PASSWORD is required and must have at least 8 characters.');
  process.exit(1);
}

async function run() {
  const client = new Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  await client.connect();

  try {
    await client.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username VARCHAR(80)');

    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await client.query(
      `SELECT id
       FROM usuarios
       WHERE rol = 'superadmin'
          OR lower(email) = $1
          OR lower(COALESCE(username, '')) = $2
       ORDER BY CASE WHEN rol = 'superadmin' THEN 0 ELSE 1 END, id
       LIMIT 1`,
      [email, username.toLowerCase()]
    );

    if (existing.rows[0]) {
      const result = await client.query(
        `UPDATE usuarios
         SET empresa_id = NULL,
             nombre = $1,
             username = $2,
             email = $3,
             password_hash = $4,
             rol = 'superadmin',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING id, username, email, rol`,
        [name, username, email, passwordHash, existing.rows[0].id]
      );
      console.log(`Superadmin actualizado: ${result.rows[0].username} (${result.rows[0].email})`);
      return;
    }

    const result = await client.query(
      `INSERT INTO usuarios (empresa_id, nombre, username, email, password_hash, rol)
       VALUES (NULL, $1, $2, $3, $4, 'superadmin')
       RETURNING id, username, email, rol`,
      [name, username, email, passwordHash]
    );
    console.log(`Superadmin creado: ${result.rows[0].username} (${result.rows[0].email})`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('No se pudo asegurar el superadmin:', error.message);
  process.exit(1);
});
