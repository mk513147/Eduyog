const path = require('path');
const dotenv = require('dotenv');

// Load backend/.env regardless of the directory the server is started from.
// A missing .env file is not an error; values may come from the real environment.
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const VALID_NODE_ENVS = ['development', 'production', 'test'];
const DEFAULT_PORT = 5000;
// Admin (5173), Fitness (5174) and Eduyarp (5175) Vite dev servers.
const DEFAULT_DEV_FRONTEND_URL = 'http://localhost:5173,http://localhost:5174,http://localhost:5175';

const errors = [];

const nodeEnv = process.env.NODE_ENV || 'development';
if (!VALID_NODE_ENVS.includes(nodeEnv)) {
  errors.push(`NODE_ENV must be one of: ${VALID_NODE_ENVS.join(', ')}`);
}

let port = DEFAULT_PORT;
if (process.env.PORT !== undefined && process.env.PORT !== '') {
  port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535');
  }
}

// FRONTEND_URL is a comma-separated list of allowed CORS origins.
// Required in production; development falls back to the Vite default.
let frontendUrlRaw = process.env.FRONTEND_URL;
if (!frontendUrlRaw) {
  if (nodeEnv === 'production') {
    errors.push('FRONTEND_URL is required in production');
  } else {
    frontendUrlRaw = DEFAULT_DEV_FRONTEND_URL;
  }
}

const frontendUrls = (frontendUrlRaw || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

for (const url of frontendUrls) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    errors.push(`FRONTEND_URL contains an invalid URL: ${url}`);
    continue;
  }
  // CORS compares against the bare origin, so reject paths or trailing slashes.
  if (parsed.origin !== url) {
    errors.push(`FRONTEND_URL entries must be origins without a path, e.g. ${parsed.origin}`);
  }
}

// JWT_SECRET signs access tokens. Required in every environment because
// authentication cannot work without it.
const JWT_SECRET_PLACEHOLDER = 'replace_with_a_random_string_of_at_least_32_characters';
const JWT_SECRET_MIN_LENGTH = 32;
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  errors.push('JWT_SECRET is required');
} else if (jwtSecret === JWT_SECRET_PLACEHOLDER) {
  errors.push('JWT_SECRET is still the placeholder from .env.example; set a random value');
} else if (jwtSecret.length < JWT_SECRET_MIN_LENGTH) {
  errors.push(`JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`);
}

// A unit is required: jsonwebtoken reads a bare number string as milliseconds.
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';
if (!/^[1-9]\d*[smhd]$/.test(jwtExpiresIn)) {
  errors.push('JWT_EXPIRES_IN must be a positive number followed by s, m, h or d (e.g. 1h)');
}

if (errors.length > 0) {
  console.error('Invalid environment configuration:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

// PostgreSQL settings are passed to the pool as-is and not validated here.
module.exports = {
  nodeEnv,
  port,
  frontendUrls,
  jwt: {
    secret: jwtSecret,
    expiresIn: jwtExpiresIn,
  },
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
};
