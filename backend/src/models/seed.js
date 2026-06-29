const bcrypt = require('bcryptjs');

async function seedData(client) {
  try {
    console.log('Seeding database with complete Kolben demo data...');
    const superadminPass = await bcrypt.hash('SuperAdminPassword123', 10);
    const adminPass = await bcrypt.hash('KolbenAdminPassword123', 10);
    const clientPass = await bcrypt.hash('ClientPassword123', 10);

    // 1. Create Empresa (Tenant)
    const empresaRes = await client.query(`
      INSERT INTO empresas (nombre, subnombre, slug, logo_url, color_primario, color_secundario, fuente, activa)
      VALUES (
        'KOLBEN HONDURAS',
        'Repuestos mayoristas',
        'kolben',
        '/uploads/kolben/tenant/1780243142552-209691e5676f.webp',
        '#F5C200',
        '#111111',
        'Barlow',
        true
      )
      RETURNING id
    `);
    const kolbenId = empresaRes.rows[0].id;

    // 2. Create Users
    const superadminRes = await client.query(`
      INSERT INTO usuarios (empresa_id, nombre, username, email, password_hash, rol)
      VALUES (NULL, 'Super Administrador', 'superadmin', 'superadmin@catalogohn.com', $1, 'superadmin')
      RETURNING id
    `, [superadminPass]);

    const adminRes = await client.query(`
      INSERT INTO usuarios (empresa_id, nombre, username, email, password_hash, rol)
      VALUES ($1, 'Administrador Kolben', 'admin', 'admin@kolben.com', $2, 'admin')
      RETURNING id
    `, [kolbenId, adminPass]);

    const clientUserRes = await client.query(`
      INSERT INTO usuarios (empresa_id, nombre, username, email, password_hash, rol)
      VALUES ($1, 'Auto Repuestos El Centro', 'cliente1', 'cliente1@autorepuestos.com', $2, 'cliente')
      RETURNING id
    `, [kolbenId, clientPass]);
    const clientUserId = clientUserRes.rows[0].id;

    const clientUser2Res = await client.query(`
      INSERT INTO usuarios (empresa_id, nombre, username, email, password_hash, rol)
      VALUES ($1, 'Repuestos El Amigo', 'cliente2', 'cliente2@elamigo.com', $2, 'cliente')
      RETURNING id
    `, [kolbenId, clientPass]);
    const clientUser2Id = clientUser2Res.rows[0].id;

    // 3. Create Clientes
    const client1Res = await client.query(`
      INSERT INTO clientes (usuario_id, empresa_id, condicion_credito, activo)
      VALUES ($1, $2, 'Credito 30 Dias', true)
      RETURNING id
    `, [clientUserId, kolbenId]);
    const client1Id = client1Res.rows[0].id;

    const client2Res = await client.query(`
      INSERT INTO clientes (usuario_id, empresa_id, condicion_credito, activo)
      VALUES ($1, $2, 'Contado', true)
      RETURNING id
    `, [clientUser2Id, kolbenId]);
    const client2Id = client2Res.rows[0].id;

    // 4. Create Sucursales
    await client.query(`
      INSERT INTO sucursales (cliente_id, nombre, direccion, activo)
      VALUES 
        ($1, 'Sucursal Centro', 'San Pedro Sula', true),
        ($1, 'Sucursal Circunvalacion', 'San Pedro Sula', true),
        ($1, 'Sucursal Taller Norte', 'Choloma', true),
        ($2, 'Sucursal Principal', 'Tegucigalpa', true)
    `, [client1Id, client2Id]);

    // 5. Create Brands (Marcas)
    const brandsRes = await client.query(`
      INSERT INTO marcas (empresa_id, nombre, logo_url, posicion)
      VALUES 
        ($1, 'KOLBEN', '', 1),
        ($1, 'FIC', '', 2),
        ($1, 'SMC', '', 3),
        ($1, 'LPR', '', 4)
      RETURNING id, nombre
    `, [kolbenId]);
    const brandKolben = brandsRes.rows.find(b => b.nombre === 'KOLBEN');
    const brandFic = brandsRes.rows.find(b => b.nombre === 'FIC');
    const brandSmc = brandsRes.rows.find(b => b.nombre === 'SMC');
    const brandLpr = brandsRes.rows.find(b => b.nombre === 'LPR');

    // 6. Create Categories (Categorias)
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

    // 7. Create Products
    const productsRes = await client.query(`
      INSERT INTO productos (empresa_id, marca_id, categoria_id, sku, descripcion, specs, visible, en_promocion, posicion, stock_actual, stock_minimo)
      VALUES 
        ($1, $2, $3, 'BF-3129', 'Bomba de Freno Principal con Deposito', '{"medida": "15/16\\"", "aplicacion": "Toyota Corolla AE100 1.6L (1993 - 1997)", "origen": "Japon", "material": "Aluminio"}', true, true, 1, 15, 2),
        ($1, $2, $4, 'BC-4211', 'Bomba de Clutch Superior', '{"medida": "5/8\\"", "aplicacion": "Nissan Frontier D22 TD27 (1998 - 2005)", "origen": "Japon", "material": "Hierro"}', true, false, 2, 8, 1),
        ($1, $5, $6, 'CF-6802', 'Cilindro de Rueda Auxiliar Trasero', '{"medida": "11/16\\"", "aplicacion": "Toyota Hilux 4x4 KUN25 (2005 - 2015)", "origen": "Taiwan", "lado": "Derecho / Izquierdo"}', true, false, 3, 20, 3),
        ($1, $7, $3, 'BF-7210', 'Bomba de Freno Principal', '{"medida": "7/8\\"", "aplicacion": "Hyundai Elantra MD 1.8L (2011 - 2016)", "origen": "Corea"}', true, true, 4, 12, 2),
        ($1, $2, $8, 'CC-1804', 'Cilindro de Clutch Auxiliar (Bajo)', '{"medida": "3/4\\"", "aplicacion": "Isuzu D-Max 3.0L 4JJ1 (2007 - 2012)", "origen": "Japon"}', true, false, 5, 0, 1),
        ($1, $5, $3, 'BF-9180', 'Bomba de Freno con Sensor', '{"medida": "1\\"", "aplicacion": "Mitsubishi L200 Triton 2.5L (2006 - 2015)", "origen": "Taiwan"}', true, false, 6, 4, 1),
        ($1, $9, $6, 'CF-3044', 'Cilindro de Freno Trasero', '{"medida": "3/4\\"", "aplicacion": "Mazda BT-50 2.5L (2008 - 2012)", "origen": "Corea"}', true, false, 7, 10, 2),
        ($1, $2, $3, 'BF-8822', 'Bomba de Freno Premium', '{"medida": "13/16\\"", "aplicacion": "Honda Civic DX/LX (2006 - 2011)", "origen": "Japon"}', true, true, 8, 25, 4)
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
      brandSmc.id
    ]);

    const pBf3129 = productsRes.rows.find(p => p.sku === 'BF-3129');
    const pBc4211 = productsRes.rows.find(p => p.sku === 'BC-4211');
    const pCf6802 = productsRes.rows.find(p => p.sku === 'CF-6802');
    const pBf7210 = productsRes.rows.find(p => p.sku === 'BF-7210');
    const pCc1804 = productsRes.rows.find(p => p.sku === 'CC-1804');
    const pBf9180 = productsRes.rows.find(p => p.sku === 'BF-9180');
    const pCf3044 = productsRes.rows.find(p => p.sku === 'CF-3044');
    const pBf8822 = productsRes.rows.find(p => p.sku === 'BF-8822');

    // 8. Create Product Images (using existing upload files first, with unsplash fallback)
    await client.query(`
      INSERT INTO producto_imagenes (producto_id, url, orden)
      VALUES 
        ($1, '/uploads/kolben/product/1780885179814-40aa0f0a6c23.webp', 1),
        ($2, '/uploads/kolben/product/1780918786735-2bba02c3f992.webp', 1),
        ($3, 'https://images.unsplash.com/photo-1616422285623-13ff0162193c?auto=format&fit=crop&q=80&w=400', 1),
        ($4, 'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&q=80&w=400', 1),
        ($5, 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=400', 1),
        ($6, 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&q=80&w=400', 1),
        ($7, 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=400', 1),
        ($8, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=400', 1)
    `, [
      pBf3129.id, pBc4211.id, pCf6802.id, pBf7210.id, pCc1804.id, pBf9180.id, pCf3044.id, pBf8822.id
    ]);

    // 9. Create Price Lists
    const listsRes = await client.query(`
      INSERT INTO listas_precios (empresa_id, nombre)
      VALUES 
        ($1, 'Distribuidor Mayorista'),
        ($1, 'Distribuidor VIP')
      RETURNING id, nombre
    `, [kolbenId]);
    const listMayorista = listsRes.rows.find(l => l.nombre === 'Distribuidor Mayorista');
    const listVip = listsRes.rows.find(l => l.nombre === 'Distribuidor VIP');

    // 10. Link Clients to Price Lists
    await client.query(`
      INSERT INTO cliente_lista_precio (cliente_id, lista_precio_id)
      VALUES 
        ($1, $3),
        ($2, $4)
    `, [client1Id, client2Id, listMayorista.id, listVip.id]);

    // 11. Create Prices
    await client.query(`
      INSERT INTO precios (producto_id, lista_precio_id, precio, precio_promocion, promo_activa)
      VALUES 
        -- BF-3129
        ($1, $9, 1250.00, 1050.00, true),
        ($1, $10, 1100.00, 950.00, true),
        
        -- BC-4211
        ($2, $9, 850.00, NULL, false),
        ($2, $10, 720.00, NULL, false),
        
        -- CF-6802
        ($3, $9, 450.00, NULL, false),
        ($3, $10, 380.00, NULL, false),
        
        -- BF-7210
        ($4, $9, 1680.00, 1490.00, true),
        ($4, $10, 1450.00, 1300.00, true),
        
        -- CC-1804
        ($5, $9, 620.00, NULL, false),
        ($5, $10, 530.00, NULL, false),
        
        -- BF-9180
        ($6, $9, 2100.00, NULL, false),
        ($6, $10, 1850.00, NULL, false),
        
        -- CF-3044
        ($7, $9, 480.00, NULL, false),
        ($7, $10, 410.00, NULL, false),
        
        -- BF-8822
        ($8, $9, 1400.00, 1190.00, true),
        ($8, $10, 1250.00, 1050.00, true)
    `, [
      pBf3129.id, pBc4211.id, pCf6802.id, pBf7210.id, pCc1804.id, pBf9180.id, pCf3044.id, pBf8822.id,
      listMayorista.id, listVip.id
    ]);

    // 12. Insert historic mock Order
    const pedidoRes = await client.query(`
      INSERT INTO pedidos (empresa_id, cliente_id, numero, estado, total, isv, fecha)
      VALUES ($1, $2, 'PED-10001', 'pendiente', 2600.00, 339.13, NOW() - INTERVAL '1 day')
      RETURNING id
    `, [kolbenId, client1Id]);
    const pedidoId = pedidoRes.rows[0].id;

    const sucRes = await client.query(`SELECT id FROM sucursales WHERE cliente_id = $1 LIMIT 1`, [client1Id]);
    const sucId = sucRes.rows[0].id;

    await client.query(`
      INSERT INTO pedido_items (pedido_id, producto_id, sucursal_id, cantidad, precio_unitario)
      VALUES 
        ($1, $2, $3, 2, 850.00),
        ($1, $3, $3, 2, 450.00)
    `, [pedidoId, pBc4211.id, sucId]);

    console.log('Complete database seeding with products and images completed successfully!');
  } catch (err) {
    console.error('Error seeding data:', err);
    throw err;
  }
}

module.exports = {
  seedData
};
