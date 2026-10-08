const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, applyMigration, createUser } = require('./helpers');

let db;
let existing;

before(async () => {
  // Migrations 001-006 first, with a user that already exists when 007 is applied.
  db = await createTestDatabase({ upTo: '006' });
  existing = await createUser(db.pool, { role: 'student', fullName: 'Existing User' });
});

after(async () => {
  await db.drop();
});

async function violation(sql, params) {
  try {
    await db.pool.query(sql, params);
  } catch (err) {
    return err;
  }
  return null;
}

test('007 applies after 001-006 and keeps existing users', async () => {
  await applyMigration(db.pool, '007');
  const { rows } = await db.pool.query('SELECT full_name, role FROM users WHERE id = $1', [existing.id]);
  assert.equal(rows[0].full_name, 'Existing User');
  assert.equal(rows[0].role, 'student');
});

test('users.password_changed_at exists and is NULL for existing users (no session is invalidated)', async () => {
  const { rows } = await db.pool.query('SELECT password_changed_at FROM users WHERE id = $1', [existing.id]);
  assert.equal(rows[0].password_changed_at, null);
  const col = await db.pool.query(
    "SELECT is_nullable, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_changed_at'"
  );
  assert.equal(col.rows[0].is_nullable, 'YES');
  assert.equal(col.rows[0].data_type, 'timestamp with time zone');
});

test('007 fails when run a second time', async () => {
  const sql = require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', 'database', 'schema', '007_account_profiles.sql'),
    'utf8'
  );
  // A dedicated connection: the failed script leaves its transaction open.
  const conn = await db.pool.connect();
  try {
    await assert.rejects(conn.query(sql), /already exists/);
  } finally {
    await conn.query('ROLLBACK').catch(() => {});
    conn.release();
  }
});

test('user_profiles accepts a valid row and defaults timestamps', async () => {
  await db.pool.query(
    `INSERT INTO user_profiles (user_id, phone, institution, study_level, field_of_study, graduation_year, bio, avatar_url)
     VALUES ($1, '+91 98765 43210', 'Test University', 'postgraduate', 'Data', 2027, 'Hello', 'https://example.com/a.png')`,
    [existing.id]
  );
  const { rows } = await db.pool.query('SELECT created_at, updated_at FROM user_profiles WHERE user_id = $1', [existing.id]);
  assert.ok(rows[0].created_at && rows[0].updated_at);
});

test('updated_at changes when the profile is updated', async () => {
  const before = (await db.pool.query('SELECT updated_at FROM user_profiles WHERE user_id = $1', [existing.id])).rows[0].updated_at;
  await new Promise((r) => setTimeout(r, 20));
  await db.pool.query("UPDATE user_profiles SET bio = 'Changed' WHERE user_id = $1", [existing.id]);
  const after = (await db.pool.query('SELECT updated_at FROM user_profiles WHERE user_id = $1', [existing.id])).rows[0].updated_at;
  assert.ok(after > before);
});

test('user_id is a primary key (one profile per user)', async () => {
  const err = await violation('INSERT INTO user_profiles (user_id) VALUES ($1)', [existing.id]);
  assert.equal(err.code, '23505');
});

test('foreign key: a profile needs an existing user', async () => {
  const err = await violation('INSERT INTO user_profiles (user_id) VALUES (999999999)');
  assert.equal(err.code, '23503');
});

test('deleting a user cascades to the profile', async () => {
  const user = await createUser(db.pool);
  await db.pool.query("INSERT INTO user_profiles (user_id, bio) VALUES ($1, 'x')", [user.id]);
  await db.pool.query('DELETE FROM users WHERE id = $1', [user.id]);
  const { rowCount } = await db.pool.query('SELECT 1 FROM user_profiles WHERE user_id = $1', [user.id]);
  assert.equal(rowCount, 0);
});

test('study_level only allows the six values', async () => {
  for (const level of ['school', 'diploma', 'undergraduate', 'postgraduate', 'phd', 'other']) {
    const u = await createUser(db.pool);
    await db.pool.query('INSERT INTO user_profiles (user_id, study_level) VALUES ($1, $2)', [u.id, level]);
  }
  const u = await createUser(db.pool);
  const err = await violation('INSERT INTO user_profiles (user_id, study_level) VALUES ($1, $2)', [u.id, 'masters']);
  assert.equal(err.constraint, 'user_profiles_study_level_valid');
});

test('graduation_year is limited to 1950-2100', async () => {
  for (const year of [1949, 2101, 0]) {
    const u = await createUser(db.pool);
    const err = await violation('INSERT INTO user_profiles (user_id, graduation_year) VALUES ($1, $2)', [u.id, year]);
    assert.equal(err.constraint, 'user_profiles_graduation_year_valid', `year ${year}`);
  }
  for (const year of [1950, 2100]) {
    const u = await createUser(db.pool);
    await db.pool.query('INSERT INTO user_profiles (user_id, graduation_year) VALUES ($1, $2)', [u.id, year]);
  }
});

test('avatar_url only allows http(s) URLs up to 2048 characters', async () => {
  for (const bad of ['javascript:alert(1)', 'data:image/png;base64,AA', 'ftp://x.example/a.png', 'https://a b.example/c', `https://example.com/${'a'.repeat(2100)}`]) {
    const u = await createUser(db.pool);
    const err = await violation('INSERT INTO user_profiles (user_id, avatar_url) VALUES ($1, $2)', [u.id, bad]);
    assert.equal(err.constraint, 'user_profiles_avatar_url_valid', bad.slice(0, 30));
  }
});

test('phone must look like a phone number; bio is limited to 1000 characters', async () => {
  let u = await createUser(db.pool);
  let err = await violation('INSERT INTO user_profiles (user_id, phone) VALUES ($1, $2)', [u.id, 'call me']);
  assert.equal(err.constraint, 'user_profiles_phone_valid');
  u = await createUser(db.pool);
  err = await violation('INSERT INTO user_profiles (user_id, bio) VALUES ($1, $2)', [u.id, 'a'.repeat(1001)]);
  assert.equal(err.code, '22001');
});
