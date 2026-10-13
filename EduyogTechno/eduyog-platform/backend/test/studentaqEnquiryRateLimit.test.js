// Rate limit of POST /api/studentaq-enquiries: 10 per hour per client. Same in-process setup as
// studentaqEnquiry.test.js (fake pool, no PostgreSQL), in its own file so it has its own counter.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const net = require('net');
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

let base;
let server;
let stored = 0;

before(async () => {
  const databasePath = require.resolve('../config/database');
  const fakePool = {
    async query() {
      stored += 1;
      return { rows: [] };
    },
    on() {},
    end() {},
  };
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

test('the 11th submission within the hour is refused with 429 and not stored', async () => {
  const body = JSON.stringify({
    fullName: 'Asha Rao',
    email: 'asha@example.com',
    phone: '+44 7123 456789',
    currentCountry: 'India',
    status: 'Recent graduate',
    targetCountry: 'UK',
    services: ['LinkedIn profile'],
    consent: true,
  });
  const send = () =>
    fetch(`${base}/api/studentaq-enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  for (let i = 0; i < 10; i++) assert.equal((await send()).status, 201);
  const blocked = await send();
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { error: { message: 'Too many enquiries, please try again later' } });
  assert.equal(stored, 10);
});
