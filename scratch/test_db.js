const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:Powerhn12@localhost:5432/catalogohn' });

pool.query(`SELECT p.id, COALESCE(json_agg(DISTINCT pi.url) FILTER (WHERE pi.url IS NOT NULL), '[]') AS imagenes FROM productos p LEFT JOIN producto_imagenes pi ON pi.producto_id = p.id GROUP BY p.id LIMIT 3`)
  .then(res => {
    console.log(res.rows);
    console.log(typeof res.rows[0].imagenes, Array.isArray(res.rows[0].imagenes));
    pool.end();
  });
