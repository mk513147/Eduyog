// StudentAQ enquiry endpoint (POST /api/studentaq-enquiries). Runs the real server.js in this
// process (real middleware, limiter and error handler) with config/database replaced by an
// in-memory fake, so no PostgreSQL connection is made and no migration is executed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
require('./helpers'); // sets JWT_SECRET and NODE_ENV=test before server.js loads

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
    probe.on('error', reject);
  });

const queries = [];
let failure = null;
const fakePool = {
  async query(sql, params) {
    if (failure) throw failure;
    queries.push({ sql, params });
    return { rows: [] };
  },
  on() {},
  end() {},
};

let base;
let server;

before(async () => {
  const databasePath = require.resolve('../config/database');
  require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: fakePool };
  const port = await freePort();
  process.env.PORT = String(port);
  // server.js starts listening when loaded; keep a handle on the server to close it afterwards.
  const realListen = http.Server.prototype.listen;
  http.Server.prototype.listen = function listen(...args) {
    server = this;
    http.Server.prototype.listen = realListen;
    return realListen.apply(this, args);
  };
  require('../server.js');
  base = `http://localhost:${port}`;
  const deadline = Date.now() + 10000;
  for (;;) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) throw new Error('server did not start');
    await new Promise((r) => setTimeout(r, 50));
  }
});

after(() => server && server.close());

const valid = () => ({
  fullName: '  Asha Rao ',
  email: 'Asha@Example.com ',
  phone: '+44 7123 456789',
  currentCountry: 'India',
  status: 'Recent graduate',
  targetCountry: 'UK',
  university: '',
  course: 'MSc Finance',
  services: ['CV creation & improvement', 'LinkedIn profile'],
  message: 'Looking for graduate roles.',
  consent: true,
  website_url: '',
});

const post = (body, { raw } = {}) =>
  fetch(`${base}/api/studentaq-enquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw === undefined ? JSON.stringify(body) : raw,
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }));

test('valid submission is stored with parameterized, sanitized values and echoes nothing', async () => {
  queries.length = 0;
  const res = await post({ ...valid(), id: 99, role: 'admin', approvalStatus: 'approved', createdAt: 'x' });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body, { message: 'Enquiry received' });
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /INSERT INTO studentaq_enquiries/);
  assert.match(queries[0].sql, /\$11\)/);
  assert.doesNotMatch(queries[0].sql, /Asha|admin|approved/);
  assert.deepEqual(queries[0].params, [
    'Asha Rao', 'asha@example.com', '+44 7123 456789', 'India', 'Recent graduate', 'UK',
    null, 'MSc Finance', ['CV creation & improvement', 'LinkedIn profile'], 'Looking for graduate roles.', true,
  ]);
});

test('missing required fields are rejected with field errors and nothing is stored', async () => {
  queries.length = 0;
  const res = await post({});
  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, 'Validation failed');
  for (const field of ['fullName', 'email', 'phone', 'currentCountry', 'status', 'targetCountry', 'services', 'consent']) {
    assert.ok(res.body.error.details[field], `${field} should be reported`);
  }
  assert.equal(queries.length, 0);
});

test('invalid values are rejected', async () => {
  queries.length = 0;
  const res = await post({
    ...valid(),
    email: 'not-an-email',
    phone: 'abc',
    currentCountry: 'Mars',
    status: 'Wizard',
    targetCountry: 'Moon',
    services: [],
    consent: 'yes',
    fullName: 'x'.repeat(101),
    message: 'x'.repeat(1001),
  });
  assert.equal(res.status, 400);
  assert.deepEqual(
    Object.keys(res.body.error.details).sort(),
    ['consent', 'currentCountry', 'email', 'fullName', 'message', 'phone', 'services', 'status', 'targetCountry']
  );
  assert.equal(queries.length, 0);
});

test('malformed requests: bad JSON, non-object body, oversized body', async () => {
  queries.length = 0;
  const badJson = await post(null, { raw: '{"fullName": ' });
  assert.equal(badJson.status, 400);
  assert.equal(badJson.body.error.message, 'Request body must be valid JSON');

  const array = await post([valid()]);
  assert.equal(array.status, 400);

  const big = await post(null, { raw: JSON.stringify({ ...valid(), message: 'x'.repeat(30 * 1024) }) });
  assert.equal(big.status, 413);
  assert.equal(queries.length, 0);
});

test('a filled honeypot is answered like a success but stores nothing', async () => {
  queries.length = 0;
  const res = await post({ ...valid(), website_url: 'http://spam.example' });
  assert.equal(res.status, 201);
  assert.equal(queries.length, 0);
});

test('a database error gives a generic 500 that leaks nothing', async () => {
  failure = new Error('connection refused to db.internal with secret');
  const original = console.error;
  console.error = () => {};
  try {
    const res = await post(valid());
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: { message: 'Internal server error' } });
  } finally {
    console.error = original;
    failure = null;
  }
});

test('stored enquiries are not readable through the API', async () => {
  for (const [method, url] of [['GET', '/api/studentaq-enquiries'], ['GET', '/api/studentaq-enquiries/1'], ['DELETE', '/api/studentaq-enquiries/1']]) {
    const res = await fetch(`${base}${url}`, { method });
    assert.equal(res.status, 404, `${method} ${url}`);
  }
  // Everything under /api/admin needs an Admin token.
  assert.equal((await fetch(`${base}/api/admin/studentaq-enquiries`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/studentaq-enquiries`, { headers: { Authorization: 'Bearer nope' } })).status, 401);
});

test('migration 014 is forward-only: it only creates the new table and its index', () => {
  const file = path.join(__dirname, '..', '..', 'database', 'schema', '014_studentaq_enquiries.sql');
  const sql = fs.readFileSync(file, 'utf8');
  const statements = sql.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(
    statements.map((s) => s.split(/\s+/).slice(0, 3).join(' ')),
    ['BEGIN', 'CREATE TABLE studentaq_enquiries', 'CREATE INDEX studentaq_enquiries_created_at_idx', 'COMMIT']
  );
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /\b(DROP|DELETE|UPDATE|TRUNCATE|ALTER)\b/i);
  assert.match(sql, /CHECK \(consent\)/);
});
