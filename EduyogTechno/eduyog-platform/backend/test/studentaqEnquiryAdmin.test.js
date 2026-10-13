// Admin list: GET /api/admin/studentaq-enquiries. MOCKED database: the real server.js (routing,
// authenticate, requireAdmin, error handler) runs in this process with config/database replaced by an
// in-memory fake, so no PostgreSQL connection is made and no migration is executed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const net = require('net');
const { tokenFor } = require('./helpers'); // also sets JWT_SECRET and NODE_ENV=test before server.js loads

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
    probe.on('error', reject);
  });

// Users the fake database knows: id 1 is an Admin, id 2 an approved Student.
const USERS = { 1: 'admin', 2: 'student' };
let stored = [];
let failure = null;
const queries = [];
const fakePool = {
  async query(sql, params) {
    if (/FROM users/.test(sql)) {
      const role = USERS[params[0]];
      const user = { id: params[0], full_name: 'T', email: 't@test.example', role, approval_status: 'approved', created_at: new Date(), password_changed_at: null };
      return { rows: role ? [user] : [] };
    }
    if (failure) throw failure;
    if (/FROM studentaq_enquiries/.test(sql)) {
      queries.push({ sql, params });
      if (/count\(\*\)/.test(sql)) return { rows: [{ total: String(stored.length) }] };
      return { rows: stored.slice(params[1], params[1] + params[0]) };
    }
    throw new Error(`unexpected query: ${sql}`);
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
  const realListen = http.Server.prototype.listen;
  http.Server.prototype.listen = function listen(...args) {
    server = this;
    http.Server.prototype.listen = realListen;
    return realListen.apply(this, args);
  };
  require('../server.js');
  base = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('server did not start');
});

after(() => server && server.close());

const row = (id, createdAt) => ({
  id: String(id),
  full_name: `Student ${id}`,
  email: `s${id}@example.com`,
  phone: '+44 7123 456789',
  current_country: 'India',
  status: 'Recent graduate',
  target_country: 'UK',
  university: null,
  course: null,
  services: ['LinkedIn profile'],
  message: null,
  created_at: new Date(createdAt),
});

const list = (qs = '', token) =>
  fetch(`${base}/api/admin/studentaq-enquiries${qs}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(
    async (res) => ({ status: res.status, body: await res.json().catch(() => null) })
  );

test('Admin gets the stored fields newest first, with total, limit and offset', async () => {
  stored = [row(3, '2026-03-01'), row(2, '2026-02-01'), row(1, '2026-01-01')];
  queries.length = 0;
  const res = await list('', tokenFor(1));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.enquiries.map((e) => e.id), ['3', '2', '1']);
  assert.deepEqual([res.body.total, res.body.limit, res.body.offset], [3, 50, 0]);
  assert.deepEqual(Object.keys(res.body.enquiries[0]).sort(), [
    'course', 'createdAt', 'currentCountry', 'email', 'fullName', 'id', 'message', 'phone', 'services', 'status', 'targetCountry', 'university',
  ]);
  assert.match(queries[0].sql, /ORDER BY created_at DESC, id DESC LIMIT \$1 OFFSET \$2/);
  assert.deepEqual(queries[0].params, [50, 0]);
  const paged = await list('?limit=1&offset=1', tokenFor(1));
  assert.deepEqual(paged.body.enquiries.map((e) => e.id), ['2']);
});

test('no enquiries is a valid empty response', async () => {
  stored = [];
  const res = await list('', tokenFor(1));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { enquiries: [], total: 0, limit: 50, offset: 0 });
});

test('anonymous and bad tokens get 401, an authenticated Student gets 403', async () => {
  stored = [row(1, '2026-01-01')];
  queries.length = 0;
  assert.equal((await list('')).status, 401);
  assert.equal((await list('', 'garbage')).status, 401);
  const student = await list('', tokenFor(2));
  assert.equal(student.status, 403);
  assert.equal(student.body.error.message, 'Admin access required');
  assert.equal(queries.length, 0, 'no enquiry was read for a denied request');
});

test('an invalid limit or offset is a 400', async () => {
  for (const qs of ['?limit=0', '?limit=101', '?limit=abc', '?offset=-1', '?offset=1.5']) {
    const res = await list(qs, tokenFor(1));
    assert.equal(res.status, 400, qs);
    assert.equal(res.body.error.message, 'Validation failed');
  }
});

test('a database error gives a generic 500 that leaks nothing', async () => {
  failure = new Error('relation "studentaq_enquiries" does not exist');
  const original = console.error;
  console.error = () => {};
  try {
    const res = await list('', tokenFor(1));
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: { message: 'Internal server error' } });
  } finally {
    console.error = original;
    failure = null;
  }
});

test('the public submission route is unchanged: still no public read', async () => {
  assert.equal((await fetch(`${base}/api/studentaq-enquiries`)).status, 404);
  const post = await fetch(`${base}/api/studentaq-enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(post.status, 400, 'still validated, no token needed');
});
