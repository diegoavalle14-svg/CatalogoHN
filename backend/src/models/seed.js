const bcrypt = require('bcryptjs');

async function seedData(client) {
  try {
    // 1. Hash passwords
    console.log('Hashing passwords...');
    const superadminPass = await bcrypt.hash('SuperAdminPassword123', 10);
    const adminPass = await bcrypt.hash('KolbenAdminPassword123', 10);
    const clientPass = await bcrypt.hash('ClientPassword123', 10);

    // 2. Insert Empresa (Tenant)
    console.log('Inserting tenant (KOLBEN)...');
    const empresaRes = await client.query(`
      INSERT INTO empresas (nombre, subnombre, slug, logo_url, color_primario, color_secundario, fuente, activa)
      VALUES (
        'KOLBEN HONDURAS', 
        'Repuestos mayoristas',
        'kolben', 
        'https://catalogoproyectokolben.netlify.app/img/logo-kolben.png', -- From Netlify prototype
        '#F5C200', 
        '#111111', 
        'Barlow', 
        true
      )
      RETURNING id
    `);
    const kolbenId = empresaRes.rows[0].id;

    // 3. Insert Users
    console.log('Inserting users...');
    const usersRes = await client.query(`
      INSERT INTO usuarios (empresa_id, nombre, username, email, password_hash, rol)
      VALUES 
        (NULL, 'Super Administrador', 'superadmin', 'superadmin@catalogohn.com', $1, 'superadmin'),
        ($2, 'Administrador Kolben', 'admin', 'admin@kolben.com', $3, 'admin'),
        ($2, 'Auto Repuestos El Centro', 'cliente1', 'cliente1@autorepuestos.com', $4, 'cliente'),
        ($2, 'Repuestos El Triunfo', 'cliente2', 'cliente2@repuestoseltriunfo.com', $4, 'cliente')
      RETURNING id, email, rol
    `, [superadminPass, kolbenId, adminPass, clientPass]);

    const adminUser = usersRes.rows.find(u => u.rol === 'admin');
    const clientUser1 = usersRes.rows.find(u => u.email === 'cliente1@autorepuestos.com');
    const clientUser2 = usersRes.rows.find(u => u.email === 'cliente2@repuestoseltriunfo.com');

    // 4. Insert Clientes Mayoristas
    console.log('Inserting clients...');
    const clientRes = await client.query(`
      INSERT INTO clientes (usuario_id, empresa_id, condicion_credito, activo)
      VALUES 
        ($1, $2, 'Crédito 30 Días', true),
        ($3, $2, 'Crédito 60 Días', true)
      RETURNING id, usuario_id
    `, [clientUser1.id, kolbenId, clientUser2.id]);

    const client1 = clientRes.rows.find(c => c.usuario_id === clientUser1.id);
    const client2 = clientRes.rows.find(c => c.usuario_id === clientUser2.id);

    // 5. Insert Sucursales (Branches)
    console.log('Inserting customer branches...');
    await client.query(`
      INSERT INTO sucursales (cliente_id, nombre, direccion)
      VALUES 
        ($1, 'Sucursal Centro', 'Barrio El Centro, 3 Ave, entre 4 y 5 Calle, San Pedro Sula'),
        ($1, 'Sucursal Circunvalación', 'Bulevar Circunvalación, frente a Monumento a la Madre, San Pedro Sula'),
        ($2, 'Sucursal Tegucigalpa - Centro', 'Avenida Jerez, Edificio El Triunfo, Tegucigalpa'),
        ($2, 'Sucursal Tegucigalpa - Comayagüela', '5 Avenida, 11 Calle, Comayagüela'),
        ($2, 'Sucursal Tegucigalpa - Kennedy', 'Bulevar Centroamérica, entrada principal Col. Kennedy, Tegucigalpa')
    `, [client1.id, client2.id]);

    // 6. Insert Marcas (Brands)
    console.log('Inserting brands...');
    const brandsRes = await client.query(`
      INSERT INTO marcas (empresa_id, nombre, logo_url, posicion)
      VALUES 
        ($1, 'KOLBEN', 'https://catalogoproyectokolben.netlify.app/img/logo-kolben.png', 1),
        ($1, 'FIC', 'https://catalogoproyectokolben.netlify.app/img/marca-fic.png', 2),
        ($1, 'SMC', 'https://catalogoproyectokolben.netlify.app/img/marca-smc.png', 3),
        ($1, 'LPR', 'https://catalogoproyectokolben.netlify.app/img/marca-lpr.png', 4)
      RETURNING id, nombre
    `, [kolbenId]);

    const brandKolben = brandsRes.rows.find(b => b.nombre === 'KOLBEN');
    const brandFic = brandsRes.rows.find(b => b.nombre === 'FIC');
    const brandSmc = brandsRes.rows.find(b => b.nombre === 'SMC');
    const brandLpr = brandsRes.rows.find(b => b.nombre === 'LPR');

    // 7. Insert Categorias
    console.log('Inserting categories...');
    const catRes = await client.query(`
      INSERT INTO categorias (empresa_id, nombre, color)
      VALUES 
        ($1, 'Bomba de Freno', '#E74C3C'),
        ($1, 'Bomba de Clutch', '#3498DB'),
        ($1, 'Cilindro de Freno', '#2ECC71'),
        ($1, 'Cilindro de Clutch', '#F39C12')
      RETURNING id, nombre
    `, [kolbenId]);

    const catBombaFreno = catRes.rows.find(c => c.nombre === 'Bomba de Freno');
    const catBombaClutch = catRes.rows.find(c => c.nombre === 'Bomba de Clutch');
    const catCilindroFreno = catRes.rows.find(c => c.nombre === 'Cilindro de Freno');
    const catCilindroClutch = catRes.rows.find(c => c.nombre === 'Cilindro de Clutch');

    // 8. Insert Productos (Vehicles/specs are JSON)
    console.log('Inserting products...');
    const productSpecs = {
      bf3129: { medida: '15/16"', aplicacion: 'Toyota Corolla AE100 1.6L (1993 - 1997)', origen: 'Japon', material: 'Aluminio' },
      bc4211: { medida: '5/8"', aplicacion: 'Nissan Frontier D22 TD27 (1998 - 2005)', origen: 'Japon', material: 'Hierro' },
      cf6802: { medida: '11/16"', aplicacion: 'Toyota Hilux 4x4 KUN25 (2005 - 2015)', origen: 'Taiwan', lado: 'Derecho / Izquierdo' },
      bf7210: { medida: '7/8"', aplicacion: 'Hyundai Elantra MD 1.8L (2011 - 2016)', origen: 'Corea' },
      cc1804: { medida: '3/4"', aplicacion: 'Isuzu D-Max 3.0L 4JJ1 (2007 - 2012)', origen: 'Japon' },
      bf9180: { medida: '1"', aplicacion: 'Mitsubishi L200 Triton 2.5L (2006 - 2015)', origen: 'Taiwan' },
      cf3044: { medida: '3/4"', aplicacion: 'Mazda BT-50 2.5L (2008 - 2012)', origen: 'Corea' },
      bf8822: { medida: '13/16"', aplicacion: 'Honda Civic DX/LX (2006 - 2011)', origen: 'Japon' }
    };
    const productsRes = await client.query(`
      INSERT INTO productos (empresa_id, marca_id, categoria_id, sku, descripcion, specs, visible, en_promocion, posicion)
      VALUES 
        ($1, $2, $3, 'BF-3129', 'Bomba de Freno Principal con Deposito', $10, true, true, 1),
        ($1, $2, $4, 'BC-4211', 'Bomba de Clutch Superior', $11, true, false, 2),
        ($1, $5, $6, 'CF-6802', 'Cilindro de Rueda Auxiliar Trasero', $12, true, false, 3),
        ($1, $7, $3, 'BF-7210', 'Bomba de Freno Principal', $13, true, true, 4),
        ($1, $2, $8, 'CC-1804', 'Cilindro de Clutch Auxiliar (Bajo)', $14, true, false, 5),
        ($1, $5, $3, 'BF-9180', 'Bomba de Freno con Sensor', $15, true, false, 6),
        ($1, $9, $6, 'CF-3044', 'Cilindro de Freno Trasero', $16, true, false, 7),
        ($1, $2, $3, 'BF-8822', 'Bomba de Freno Premium', $17, true, true, 8)
      RETURNING id, sku
    `, [
      kolbenId, 
      brandKolben.id, 
      catBombaFreno.id, 
      catBombaClutch.id, 
      brandFic.id, 
      catCilindroFreno.id, 
      brandLpr.id, 
      catCilindroClutch.id, 
      brandSmc.id,
      JSON.stringify(productSpecs.bf3129),
      JSON.stringify(productSpecs.bc4211),
      JSON.stringify(productSpecs.cf6802),
      JSON.stringify(productSpecs.bf7210),
      JSON.stringify(productSpecs.cc1804),
      JSON.stringify(productSpecs.bf9180),
      JSON.stringify(productSpecs.cf3044),
      JSON.stringify(productSpecs.bf8822)
    ]);

    const pBf3129 = productsRes.rows.find(p => p.sku === 'BF-3129');
    const pBc4211 = productsRes.rows.find(p => p.sku === 'BC-4211');
    const pCf6802 = productsRes.rows.find(p => p.sku === 'CF-6802');
    const pBf7210 = productsRes.rows.find(p => p.sku === 'BF-7210');
    const pCc1804 = productsRes.rows.find(p => p.sku === 'CC-1804');
    const pBf9180 = productsRes.rows.find(p => p.sku === 'BF-9180');
    const pCf3044 = productsRes.rows.find(p => p.sku === 'CF-3044');
    const pBf8822 = productsRes.rows.find(p => p.sku === 'BF-8822');

    // 9. Insert Images (Mock images that look professional)
    console.log('Inserting product images...');
    await client.query(`
      INSERT INTO producto_imagenes (producto_id, url, orden)
      VALUES 
        ($1, 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=400', 1),
        ($1, 'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&q=80&w=400', 2),
        ($2, 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=400', 1),
        ($3, 'https://images.unsplash.com/photo-1616422285623-13ff0162193c?auto=format&fit=crop&q=80&w=400', 1),
        ($4, 'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&q=80&w=400', 1),
        ($5, 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=400', 1),
        ($6, 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&q=80&w=400', 1),
        ($7, 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=400', 1),
        ($8, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=400', 1)
    `, [
      pBf3129.id, pBc4211.id, pCf6802.id, pBf7210.id, pCc1804.id, pBf9180.id, pCf3044.id, pBf8822.id
    ]);

    // 10. Insert Listas de Precios
    console.log('Inserting pricing lists...');
    const listsRes = await client.query(`
      INSERT INTO listas_precios (empresa_id, nombre)
      VALUES 
        ($1, 'Distribuidor Mayorista'),
        ($1, 'Distribuidor VIP')
      RETURNING id, nombre
    `, [kolbenId]);

    const listMayorista = listsRes.rows.find(l => l.nombre === 'Distribuidor Mayorista');
    const listVip = listsRes.rows.find(l => l.nombre === 'Distribuidor VIP');

    // 11. Assign Clients to Lists
    console.log('Assigning clients to pricing lists...');
    await client.query(`
      INSERT INTO cliente_lista_precio (cliente_id, lista_precio_id)
      VALUES 
        ($1, $3),
        ($2, $4)
    `, [client1.id, client2.id, listMayorista.id, listVip.id]);

    // 12. Insert Precios (Segmentados por lista)
    // VIP has a ~15% discount generally, and special promos
    console.log('Inserting prices per list...');
    await client.query(`
      INSERT INTO precios (producto_id, lista_precio_id, precio, precio_promocion)
      VALUES 
        -- BF-3129
        ($1, $9, 1250.00, 1050.00), -- Mayorista (Promo)
        ($1, $10, 1100.00, 950.00), -- VIP (Promo)
        
        -- BC-4211
        ($2, $9, 850.00, NULL),
        ($2, $10, 720.00, NULL),
        
        -- CF-6802
        ($3, $9, 450.00, NULL),
        ($3, $10, 380.00, NULL),
        
        -- BF-7210
        ($4, $9, 1680.00, 1490.00), -- Promo
        ($4, $10, 1450.00, 1300.00), -- Promo
        
        -- CC-1804
        ($5, $9, 620.00, NULL),
        ($5, $10, 530.00, NULL),
        
        -- BF-9180
        ($6, $9, 2100.00, NULL),
        ($6, $10, 1850.00, NULL),
        
        -- CF-3044
        ($7, $9, 480.00, NULL),
        ($7, $10, 410.00, NULL),
        
        -- BF-8822
        ($8, $9, 1400.00, 1190.00), -- Promo
        ($8, $10, 1250.00, 1050.00)  -- Promo
    `, [
      pBf3129.id, pBc4211.id, pCf6802.id, pBf7210.id, pCc1804.id, pBf9180.id, pCf3044.id, pBf8822.id,
      listMayorista.id, listVip.id
    ]);

    // 13. Insert standard mock Pedido (to have historic data)
    console.log('Inserting historic mock order...');
    const pedidoRes = await client.query(`
      INSERT INTO pedidos (empresa_id, cliente_id, numero, estado, total, isv, fecha)
      VALUES (
        $1, 
        $2, 
        'PED-10001', 
        'pendiente', 
        3047.50, 
        397.50, 
        NOW() - INTERVAL '1 day'
      )
      RETURNING id
    `, [kolbenId, client1.id]);
    const pedidoId = pedidoRes.rows[0].id;

    // Insert items for historic order
    // Client 1 has sucursales. Let's find one.
    const sucRes = await client.query(`SELECT id FROM sucursales WHERE cliente_id = $1 LIMIT 1`, [client1.id]);
    const sucId = sucRes.rows[0].id;

    await client.query(`
      INSERT INTO pedido_items (pedido_id, producto_id, sucursal_id, cantidad, precio_unitario)
      VALUES 
        ($1, $2, $3, 2, 850.00), -- 2x BC-4211
        ($1, $4, $3, 2, 450.00)  -- 2x CF-6802
    `, [pedidoId, pBc4211.id, sucId, pCf6802.id]);

    console.log('All seed data inserted successfully!');
  } catch (err) {
    console.error('Error seeding data:', err);
    throw err;
  }
}

module.exports = {
  seedData
};
