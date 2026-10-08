// Shared test harness (Node's built-in test runner, no extra dependencies).
//
// Each test file creates its own temporary PostgreSQL database from the migrations in
// database/schema, starts the real API server against it as a child process, and drops
// everything afterwards. It never touches the development database. Database
// credentials come from backend/.env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD).

const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

// Must be set before anything from the backend is loaded: config/env.js reads it at load time.
process.env.JWT_SECRET = process.env.TEST_JWT_SECRET || `test-secret-${crypto.randomBytes(24).toString('hex')}`;
process.env.NODE_ENV = 'test';

const root = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SCHEMA_DIR = path.join(root, '..', 'database', 'schema');
const migrationFiles = () => fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.sql')).sort();

function connection(database) {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  };
}

// Creates an empty database and applies the migrations whose file name is <= `upTo`
// (for example '006'); all of them by default. Returns { name, pool, drop }.
async function createTestDatabase({ upTo = '999' } = {}) {
  const name = `eduyog_test_${crypto.randomBytes(5).toString('hex')}`;
  const admin = new Pool(connection('postgres'));
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const pool = new Pool(connection(name));
  for (const file of migrationFiles()) {
    if (file.slice(0, 3) > upTo) continue;
    await pool.query(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8'));
  }

  // The backend modules read DB_NAME when first loaded, so in-process service tests
  // point them at this database.
  process.env.DB_NAME = name;

  return {
    name,
    pool,
    async drop() {
      await pool.end();
      const cleaner = new Pool(connection('postgres'));
      await cleaner.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await cleaner.end();
    },
  };
}

async function applyMigration(pool, prefix) {
  const file = migrationFiles().find((f) => f.startsWith(prefix));
  await pool.query(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8'));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

// Starts server.js against the given database and resolves once it is listening.
async function startApi(dbName) {
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, DB_NAME: dbName, PORT: String(port), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));

  const url = `http://localhost:${port}`;
  const deadline = Date.now() + 15000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`API exited early:\n${output}`);
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`API did not start in time:\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  return {
    url,
    async stop() {
      child.kill();
      await new Promise((r) => (child.exitCode !== null ? r() : child.once('exit', r)));
    },
  };
}

// A user created directly in the database (so tests do not use the rate-limited
// register/login endpoints).
let counter = 0;
async function createUser(pool, { role = 'student', fullName, email, password = 'password123' } = {}) {
  counter += 1;
  const mail = email || `${role}${counter}-${crypto.randomBytes(3).toString('hex')}@test.example`;
  const hash = await bcrypt.hash(password, 4);
  const { rows } = await pool.query(
    'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [fullName || `Test ${role} ${counter}`, mail, hash, role]
  );
  return { id: rows[0].id, email: mail, password, role, token: tokenFor(rows[0].id) };
}

// Same signing as the API (HS256, subject = user id); `issuedAt` (seconds) overrides iat.
function tokenFor(userId, { issuedAt } = {}) {
  const payload = issuedAt === undefined ? {} : { iat: issuedAt };
  return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', subject: String(userId), expiresIn: '1h' });
}

function client(baseUrl) {
  return async function call(method, pathName, { token, body } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${pathName}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    const text = await res.text();
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json, text };
  };
}

// A published course with one module and `topicCount` topics.
async function createCourse(pool, { title = 'Course', status = 'published', topicCount = 3 } = {}) {
  counter += 1;
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${counter}`;
  const { rows } = await pool.query(
    "INSERT INTO courses (title, slug, level, status) VALUES ($1, $2, 'beginner', $3) RETURNING id",
    [title, slug, status]
  );
  const courseId = rows[0].id;
  const { rows: m } = await pool.query(
    "INSERT INTO course_modules (course_id, title, display_order) VALUES ($1, 'Module 1', 1) RETURNING id",
    [courseId]
  );
  const topicIds = [];
  for (let i = 1; i <= topicCount; i++) {
    const { rows: t } = await pool.query(
      'INSERT INTO course_topics (module_id, title, display_order) VALUES ($1, $2, $3) RETURNING id',
      [m[0].id, `Topic ${i}`, i]
    );
    topicIds.push(t[0].id);
  }
  return { id: courseId, slug, moduleId: m[0].id, topicIds };
}

const assign = (pool, courseId, trainerId) =>
  pool.query('INSERT INTO course_trainers (course_id, trainer_id) VALUES ($1, $2)', [courseId, trainerId]);

async function enrol(pool, studentId, courseId, status = 'active') {
  const { rows } = await pool.query(
    'INSERT INTO enrolments (course_id, student_id, status) VALUES ($1, $2, $3) RETURNING id',
    [courseId, studentId, status]
  );
  return rows[0].id;
}

const completeTopics = (pool, studentId, topicIds) =>
  Promise.all(
    topicIds.map((topicId) =>
      pool.query(
        'INSERT INTO topic_progress (student_id, topic_id, completed, completed_at) VALUES ($1, $2, TRUE, now())',
        [studentId, topicId]
      )
    )
  );

module.exports = {
  createTestDatabase,
  applyMigration,
  startApi,
  createUser,
  tokenFor,
  client,
  createCourse,
  assign,
  enrol,
  completeTopics,
};
