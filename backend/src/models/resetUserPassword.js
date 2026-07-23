const bcrypt = require('bcryptjs');
const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const login = String(process.env.RESET_USER || process.argv[2] || '').trim().toLowerCase();
const password = String(process.env.RESET_PASSWORD || process.argv[3] || '').trim();
const tenantSlug = String(process.env.RESET_TENANT_SLUG || process.argv[4] || '').trim().toLowerCase();

if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

if (!login) {
  console.error('RESET_USER or first argument is required.');
  process.exit(1);
}

if (!password || password.length < 8) {
  console.error('RESET_PASSWORD or second argument is required and must have at least 8 characters.');
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

    const aliases = {
      cliente1: 'cliente1@autorepuestos.com',
      admin: 'admin@kolben.com',
      superadmin: 'superadmin@catalogohn.com'
    };
    const loginValue = aliases[login] || login;
    const lookupValues = [...new Set([login, loginValue].filter(Boolean))];
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await client.query(
      `WITH target_users AS (
         SELECT u.id
         FROM usuarios u
         LEFT JOIN empresas e ON e.id = u.empresa_id
         WHERE (lower(u.email) = ANY($2::text[]) OR lower(COALESCE(u.username, '')) = ANY($2::text[]))
           AND ($3 = '' OR u.rol = 'superadmin' OR lower(COALESCE(e.slug, '')) = $3)
       )
       UPDATE usuarios u
       SET password_hash = $1,
           updated_at = CURRENT_TIMESTAMP
       FROM target_users
       WHERE u.id = target_users.id
       RETURNING u.id,
                 u.username,
                 u.email,
                 u.rol,
                 COALESCE((SELECT slug FROM empresas WHERE id = u.empresa_id), 'global') AS tenant_slug`,
      [passwordHash, lookupValues, tenantSlug]
    );

    if (!result.rows.length) {
      console.error(`No user found for "${login}"${tenantSlug ? ` in tenant "${tenantSlug}"` : ''}.`);
      process.exit(1);
    }

    for (const user of result.rows) {
      console.log(`Password updated: ${user.username || user.email} (${user.rol}, ${user.tenant_slug})`);
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('Could not reset user password:', error.message);
  process.exit(1);
});
