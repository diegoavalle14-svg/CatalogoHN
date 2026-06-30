const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set in .env file');
  process.exit(1);
}
const skipCreateDatabase = process.env.DB_SETUP_SKIP_CREATE_DATABASE === 'true';
const resetConfirmation = String(process.env.DB_SETUP_CONFIRM_RESET || '').trim();

// Parse database name and credentials from connection string
// e.g. postgres://postgres:postgres@localhost:5432/catalogohn
const dbNameMatch = connectionString.match(/\/([^\/?]+)(?:\?.*)?$/);
const dbName = dbNameMatch ? dbNameMatch[1] : 'catalogohn';
const baseUrl = connectionString.replace(/\/([^\/?]+)(?:\?.*)?$/, '/postgres'); // Default system db

function requireResetConfirmation() {
  if (process.env.NODE_ENV !== 'production') return;

  const expected = `RESET ${dbName}`;
  if (resetConfirmation === expected) return;

  console.error('Refusing to run db:setup in production because it drops and recreates all data.');
  console.error(`If you really want to reset this database, run with DB_SETUP_CONFIRM_RESET="${expected}".`);
  process.exit(1);
}

async function run() {
  console.log(`Setting up database. Targeted DB: "${dbName}"`);
  requireResetConfirmation();

  // Step 1: Connect to default postgres DB and create catalogohn if it doesn't exist
  let client;
  if (skipCreateDatabase) {
    console.log('Skipping database creation check because DB_SETUP_SKIP_CREATE_DATABASE=true.');
  } else {
    client = new Client({ connectionString: baseUrl });
    try {
      await client.connect();
      // Check if DB exists
      const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
      if (res.rowCount === 0) {
        console.log(`Database "${dbName}" does not exist. Creating it...`);
        await client.query(`CREATE DATABASE ${dbName}`);
        console.log(`Database "${dbName}" created successfully.`);
      } else {
        console.log(`Database "${dbName}" already exists.`);
      }
    } catch (err) {
      console.error('Failed to connect or create database via system DB:', err.message);
      console.log('Attempting to connect directly to target database instead...');
    } finally {
      await client.end();
    }
  }

  // Step 2: Connect directly to target DB and run schema.sql
  console.log(`Connecting directly to database "${dbName}" to run schema...`);
  client = new Client({ connectionString });
  try {
    await client.connect();

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema.sql...');
    await client.query(schemaSql);
    console.log('Schema executed successfully.');

    // Step 3: Run seed logic
    console.log('Starting data seeding...');
    const seed = require('./seed');
    await seed.seedData(client);
    console.log('Database setup and seeding completed successfully!');
  } catch (err) {
    console.error('Error during schema execution or seeding:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
