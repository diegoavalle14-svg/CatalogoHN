const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:Powerhn12@localhost:5432/catalogohn' });

async function run() {
  const clients = await pool.query(`
    SELECT c.id as client_id, u.nombre as client_name 
    FROM clientes c 
    JOIN usuarios u ON u.id = c.usuario_id
  `);
  console.log('Clients:', clients.rows);

  const branches = await pool.query(`
    SELECT s.id, s.cliente_id, s.nombre, s.direccion, s.activo
    FROM sucursales s
    ORDER BY s.cliente_id, s.id
  `);
  console.log('Branches:', branches.rows);

  const recentOrders = await pool.query(`
    SELECT p.id, p.numero, p.fecha, p.total, u.nombre as cliente_nombre
    FROM pedidos p
    JOIN clientes c ON c.id = p.cliente_id
    JOIN usuarios u ON u.id = c.usuario_id
    ORDER BY p.fecha DESC
    LIMIT 5
  `);
  console.log('Recent Orders:', recentOrders.rows);

  const orderItems = await pool.query(`
    SELECT pi.pedido_id, pi.producto_id, pi.sucursal_id, s.nombre as sucursal_nombre, pi.cantidad
    FROM pedido_items pi
    JOIN sucursales s ON s.id = pi.sucursal_id
    ORDER BY pi.pedido_id, pi.id
  `);
  console.log('Order Items:', orderItems.rows);

  pool.end();
}

run().catch(console.error);
