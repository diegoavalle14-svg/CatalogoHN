require('dotenv').config();
const db = require('./src/config/database');
db.query('SELECT * FROM pedidos ORDER BY fecha DESC LIMIT 1').then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(console.error);
