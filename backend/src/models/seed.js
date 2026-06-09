const bcrypt = require('bcryptjs');

async function seedData(client) {
  try {
    console.log('Creating minimal platform access...');
    const superadminPass = await bcrypt.hash('SuperAdminPassword123', 10);
    const adminPass = await bcrypt.hash('KolbenAdminPassword123', 10);

    const empresaRes = await client.query(`
      INSERT INTO empresas (nombre, subnombre, slug, logo_url, color_primario, color_secundario, fuente, activa)
      VALUES (
        'KOLBEN HONDURAS',
        '',
        'kolben',
        '',
        '#F5C200',
        '#111111',
        'Barlow',
        true
      )
      RETURNING id
    `);
    const kolbenId = empresaRes.rows[0].id;

    await client.query(`
      INSERT INTO usuarios (empresa_id, nombre, username, email, password_hash, rol)
      VALUES (NULL, 'Super Administrador', 'superadmin', 'superadmin@catalogohn.com', $1, 'superadmin')
    `, [superadminPass]);

    await client.query(`
      INSERT INTO usuarios (empresa_id, nombre, username, email, password_hash, rol)
      VALUES ($1, 'Administrador Kolben', 'admin', 'admin@kolben.com', $2, 'admin')
    `, [kolbenId, adminPass]);

    console.log('Minimal seed completed. Catalog, clients, prices, and orders remain empty.');
  } catch (err) {
    console.error('Error seeding minimal data:', err);
    throw err;
  }
}

module.exports = {
  seedData
};
