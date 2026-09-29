// One-off setup: creates the first Admin account.
//
//   npm run setup:admin
//
// Prompts for full name, email and password (hidden). Refuses to run if any
// Admin already exists. There is intentionally no HTTP endpoint for this.

const readline = require('readline/promises');
const { Writable } = require('stream');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { BCRYPT_ROUNDS } = require('../services/auth.service');
const { validateRegistration } = require('../utils/validators');

const UNIQUE_VIOLATION = '23505';

class SetupError extends Error {}

// Passes output through to the terminal except while muted, so typed
// password characters are never echoed.
function createMutableOutput() {
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!output.muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    },
  });
  output.muted = false;
  return output;
}

async function promptForAdmin() {
  const output = createMutableOutput();
  const abort = new AbortController();
  // historySize 0 keeps the password out of readline's up-arrow history.
  const rl = readline.createInterface({
    input: process.stdin,
    output,
    terminal: true,
    historySize: 0,
  });
  rl.on('SIGINT', () => abort.abort());

  const ask = (query) => rl.question(query, { signal: abort.signal });

  const askHidden = async (query) => {
    process.stdout.write(query);
    output.muted = true;
    try {
      return await ask('');
    } finally {
      output.muted = false;
      process.stdout.write('\n');
    }
  };

  try {
    const fullName = await ask('Full name: ');
    const email = await ask('Email: ');
    const password = await askHidden('Password (hidden): ');
    const confirmation = await askHidden('Confirm password: ');
    return { fullName, email, password, confirmation };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new SetupError('Cancelled.');
    }
    throw err;
  } finally {
    rl.close();
  }
}

async function adminExists(queryable) {
  const { rows } = await queryable.query(
    "SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin') AS exists"
  );
  return rows[0].exists;
}

async function createInitialAdmin({ fullName, email, passwordHash }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // SHARE ROW EXCLUSIVE conflicts with itself and with row writes, so a
    // concurrent setup run waits here and then sees the Admin created by the
    // first. Held only for the check and insert; hashing happens before.
    await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');

    if (await adminExists(client)) {
      throw new SetupError('An Admin account already exists. Setup has already been completed.');
    }

    const { rows } = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, email`,
      [fullName, email, passwordHash]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === UNIQUE_VIOLATION && err.constraint === 'users_email_key') {
      throw new SetupError('An account with this email already exists. Use a different email.');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  if (!process.stdin.isTTY) {
    throw new SetupError(
      'This script must be run in an interactive terminal so the password can be hidden.'
    );
  }

  // Checked before prompting so nobody types a password for nothing.
  // Re-checked under lock in createInitialAdmin.
  if (await adminExists(pool)) {
    throw new SetupError('An Admin account already exists. Setup has already been completed.');
  }

  console.log('Create the initial Eduyog Admin account.\n');
  const answers = await promptForAdmin();

  if (answers.password !== answers.confirmation) {
    throw new SetupError('Passwords do not match.');
  }

  const { value, errors } = validateRegistration(answers);
  if (errors) {
    throw new SetupError(
      `Invalid input:\n${Object.values(errors).map((message) => `  - ${message}`).join('\n')}`
    );
  }

  const passwordHash = await bcrypt.hash(value.password, BCRYPT_ROUNDS);
  const admin = await createInitialAdmin({
    fullName: value.fullName,
    email: value.email,
    passwordHash,
  });

  console.log(`\nAdmin account created (id ${admin.id}, ${admin.email}).`);
}

main()
  .catch((err) => {
    process.exitCode = 1;
    if (err instanceof SetupError) {
      console.error(`\n${err.message}`);
    } else {
      // Message only: never dump objects that could contain input values.
      console.error(`\nSetup failed: ${err.message}`);
    }
  })
  .finally(async () => {
    await pool.end().catch(() => {});
    if (process.stdin.isTTY && process.stdin.isRaw) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  });
