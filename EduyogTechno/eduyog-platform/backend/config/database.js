const { Pool } = require('pg');
const env = require('./env');

// Creating a Pool does not open a connection; clients are connected lazily
// on the first query. Unset DB_* values fall back to pg's own defaults
// (PG* environment variables, then localhost:5432).
const pool = new Pool({
  host: env.db.host,
  port: env.db.port ? Number(env.db.port) : undefined,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// An idle client can error (e.g. the database restarts). Without a listener
// the 'error' event would crash the process.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

module.exports = pool;
