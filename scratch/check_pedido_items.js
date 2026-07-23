const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:Powerhn12@localhost:5432/catalogohn' });

pool.query(`SELECT * FROM pedido_items LIMIT 5`)
  .then(res => {
    console.log('Rows:', res.rows);
    pool.end();
  })
  .catch(err => {
    console.error(err);
    pool.end();
  });
