const EMAIL_MAX_LENGTH = 254;
const FULL_NAME_MAX_LENGTH = 150;
const PASSWORD_MIN_LENGTH = 8;
// bcrypt only uses the first 72 bytes of a password; reject longer ones
// rather than silently ignoring the rest.
const PASSWORD_MAX_BYTES = 72;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Matches the users_email_normalized constraint in the schema.
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function validateEmail(email, errors) {
  if (typeof email !== 'string' || email.trim() === '') {
    errors.email = 'Email is required';
    return;
  }
  const normalized = normalizeEmail(email);
  if (normalized.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(normalized)) {
    errors.email = 'Email is invalid';
  }
}

function validateRegistration(body) {
  const { fullName, email, password } = body || {};
  const errors = {};

  if (typeof fullName !== 'string' || fullName.trim() === '') {
    errors.fullName = 'Full name is required';
  } else if (fullName.trim().length > FULL_NAME_MAX_LENGTH) {
    errors.fullName = `Full name must be at most ${FULL_NAME_MAX_LENGTH} characters`;
  }

  validateEmail(email, errors);

  if (typeof password !== 'string' || password === '') {
    errors.password = 'Password is required';
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  } else if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    errors.password = `Password must be at most ${PASSWORD_MAX_BYTES} bytes`;
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  // Any other fields, including role, are deliberately dropped here.
  return {
    value: {
      fullName: fullName.trim(),
      email: normalizeEmail(email),
      password,
    },
  };
}

function validateLogin(body) {
  const { email, password } = body || {};
  const errors = {};

  if (typeof email !== 'string' || email.trim() === '') {
    errors.email = 'Email is required';
  }
  if (typeof password !== 'string' || password === '') {
    errors.password = 'Password is required';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    value: {
      email: normalizeEmail(email),
      password,
    },
  };
}

// ---------------------------------------------------------------------------
// Admin resources
//
// Each validator returns { value } or { errors }. With { partial: true }
// (PATCH), only fields present in the body are validated and returned.
// Unknown fields are ignored.
// ---------------------------------------------------------------------------

const PLATFORM_NAME_MAX_LENGTH = 100;
const PLATFORM_SLUG_MAX_LENGTH = 100;
const SERVICE_NAME_MAX_LENGTH = 150;
const DESCRIPTION_MAX_LENGTH = 2000;
const URL_MAX_LENGTH = 2048;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Positive integer that fits in a BIGINT column.
const ID_PATTERN = /^[1-9]\d{0,17}$/;
const ROLES = ['student', 'admin'];

// Returns the id as a string, or null if it is not a valid positive integer.
function parseId(raw) {
  const id = typeof raw === 'number' ? String(raw) : raw;
  return typeof id === 'string' && ID_PATTERN.test(id) ? id : null;
}

function requiredText(input, field, label, maxLength, errors, value) {
  const raw = input[field];
  if (typeof raw !== 'string' || raw.trim() === '') {
    errors[field] = `${label} is required`;
  } else if (raw.trim().length > maxLength) {
    errors[field] = `${label} must be at most ${maxLength} characters`;
  } else {
    value[field] = raw.trim();
  }
}

// null or an empty string clears the field.
function optionalText(input, field, label, maxLength, errors, value) {
  const raw = input[field];
  if (raw === null) {
    value[field] = null;
  } else if (typeof raw !== 'string') {
    errors[field] = `${label} must be a string or null`;
  } else if (raw.trim().length > maxLength) {
    errors[field] = `${label} must be at most ${maxLength} characters`;
  } else {
    value[field] = raw.trim() === '' ? null : raw.trim();
  }
}

function optionalBoolean(input, field, label, errors, value) {
  if (typeof input[field] !== 'boolean') {
    errors[field] = `${label} must be true or false`;
  } else {
    value[field] = input[field];
  }
}

// Matches the platforms_url_format constraint: http(s)://, no whitespace.
function isHttpUrl(url) {
  if (!/^https?:\/\//i.test(url) || /\s/.test(url)) {
    return false;
  }
  try {
    return Boolean(new URL(url).hostname);
  } catch {
    return false;
  }
}

function finish(errors, value, partial) {
  if (Object.keys(errors).length > 0) {
    return { errors };
  }
  if (partial && Object.keys(value).length === 0) {
    return { errors: { body: 'Provide at least one field to update' } };
  }
  return { value };
}

function validatePlatform(body, { partial = false } = {}) {
  const input = body || {};
  const errors = {};
  const value = {};
  const has = (field) => !partial || input[field] !== undefined;

  if (has('name')) {
    requiredText(input, 'name', 'Name', PLATFORM_NAME_MAX_LENGTH, errors, value);
  }

  if (has('slug')) {
    const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
    if (slug === '') {
      errors.slug = 'Slug is required';
    } else if (slug.length > PLATFORM_SLUG_MAX_LENGTH) {
      errors.slug = `Slug must be at most ${PLATFORM_SLUG_MAX_LENGTH} characters`;
    } else if (!SLUG_PATTERN.test(slug)) {
      errors.slug = 'Slug may contain only lowercase letters, numbers and single hyphens';
    } else {
      value.slug = slug;
    }
  }

  if (input.description !== undefined) {
    optionalText(input, 'description', 'Description', DESCRIPTION_MAX_LENGTH, errors, value);
  }

  if (has('url')) {
    const url = typeof input.url === 'string' ? input.url.trim() : '';
    if (url === '') {
      errors.url = 'URL is required';
    } else if (url.length > URL_MAX_LENGTH) {
      errors.url = `URL must be at most ${URL_MAX_LENGTH} characters`;
    } else if (!isHttpUrl(url)) {
      errors.url = 'URL must be a valid http:// or https:// address';
    } else {
      value.url = url;
    }
  }

  if (input.isActive !== undefined) {
    optionalBoolean(input, 'isActive', 'isActive', errors, value);
  }

  return finish(errors, value, partial);
}

function validateService(body, { partial = false } = {}) {
  const input = body || {};
  const errors = {};
  const value = {};

  if (!partial || input.name !== undefined) {
    requiredText(input, 'name', 'Name', SERVICE_NAME_MAX_LENGTH, errors, value);
  }

  if (input.description !== undefined) {
    optionalText(input, 'description', 'Description', DESCRIPTION_MAX_LENGTH, errors, value);
  }

  // null means the service does not belong to a platform.
  if (input.platformId !== undefined) {
    if (input.platformId === null) {
      value.platformId = null;
    } else {
      const platformId = parseId(input.platformId);
      if (platformId === null) {
        errors.platformId = 'platformId must be a positive integer or null';
      } else {
        value.platformId = platformId;
      }
    }
  }

  if (input.isActive !== undefined) {
    optionalBoolean(input, 'isActive', 'isActive', errors, value);
  }

  return finish(errors, value, partial);
}

function validateRoleChange(body) {
  const { role } = body || {};
  if (!ROLES.includes(role)) {
    return { errors: { role: `Role must be one of: ${ROLES.join(', ')}` } };
  }
  return { value: { role } };
}

module.exports = {
  validateRegistration,
  validateLogin,
  parseId,
  validatePlatform,
  validateService,
  validateRoleChange,
};
