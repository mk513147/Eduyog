const { parseVideoUrl } = require('./videoUrl');

const VIDEO_URL_MAX_LENGTH = 2048;
const IMAGE_URL_MAX_LENGTH = 2048;
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

// Shared by registration and password change. Sets errors[field] when invalid.
function validatePasswordValue(password, errors, field = 'password') {
  if (typeof password !== 'string' || password === '') {
    errors[field] = 'Password is required';
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors[field] = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  } else if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    errors[field] = `Password must be at most ${PASSWORD_MAX_BYTES} bytes`;
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

  validatePasswordValue(password, errors);

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
const ROLES = ['student', 'admin', 'trainer'];

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

// Optional externally hosted image URL: a string, null or '' (cleared to null).
// Only http(s) is accepted, with a host and no embedded credentials or whitespace,
// so javascript:, data:, file:, blob: and malformed values are rejected.
function optionalImageUrl(input, field, label, errors, value) {
  const raw = input[field];
  if (raw === null) {
    value[field] = null;
    return;
  }
  if (typeof raw !== 'string') {
    errors[field] = `${label} must be a string or null`;
    return;
  }
  const url = raw.trim();
  if (url === '') {
    value[field] = null;
    return;
  }
  if (url.length > IMAGE_URL_MAX_LENGTH) {
    errors[field] = `${label} must be at most ${IMAGE_URL_MAX_LENGTH} characters`;
    return;
  }
  let parsed = null;
  if (/^https?:\/\//i.test(url) && !/\s/.test(url)) {
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || !parsed.hostname || parsed.username || parsed.password) {
    errors[field] = `${label} must be a valid http:// or https:// address without a username or password`;
    return;
  }
  value[field] = url;
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

function validatePasswordChange(body) {
  const { currentPassword, newPassword } = body || {};
  const errors = {};

  if (typeof currentPassword !== 'string' || currentPassword === '') {
    errors.currentPassword = 'Current password is required';
  }
  validatePasswordValue(newPassword, errors, 'newPassword');
  if (!errors.currentPassword && !errors.newPassword && newPassword === currentPassword) {
    errors.newPassword = 'New password must be different from the current password';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }
  return { value: { currentPassword, newPassword } };
}

const STUDY_LEVELS = ['school', 'diploma', 'undergraduate', 'postgraduate', 'phd', 'other'];
const PROFILE_FIELDS = [
  'fullName',
  'phone',
  'institution',
  'studyLevel',
  'fieldOfStudy',
  'graduationYear',
  'bio',
  'avatarUrl',
];
const PROFILE_BIO_MAX_LENGTH = 1000;
const PROFILE_PHONE_MAX_LENGTH = 30;
const PROFILE_INSTITUTION_MAX_LENGTH = 200;
const PROFILE_FIELD_OF_STUDY_MAX_LENGTH = 150;
const GRADUATION_YEAR_MIN = 1950;
const GRADUATION_YEAR_MAX = 2100;
// Fields that exist on the account but are never editable through a profile request.
const PROFILE_LOCKED_FIELDS = {
  email: 'Email cannot be changed',
  role: 'Role cannot be changed here',
};

// Profile update (own profile, or an Admin editing a user's profile). Every field is
// optional; null or an empty string clears a clearable field. Unknown fields are
// rejected so nothing (email, role, user id, password hash...) can be set by accident.
function validateProfile(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};
  const value = {};

  for (const key of Object.keys(input)) {
    if (!PROFILE_FIELDS.includes(key)) {
      errors[key] = PROFILE_LOCKED_FIELDS[key] || 'This field cannot be set';
    }
  }

  if (input.fullName !== undefined) {
    if (typeof input.fullName !== 'string' || input.fullName.trim() === '') {
      errors.fullName = 'Full name is required';
    } else if (input.fullName.trim().length > FULL_NAME_MAX_LENGTH) {
      errors.fullName = `Full name must be at most ${FULL_NAME_MAX_LENGTH} characters`;
    } else {
      value.fullName = input.fullName.trim();
    }
  }

  if (input.phone !== undefined) {
    optionalText(input, 'phone', 'Phone', PROFILE_PHONE_MAX_LENGTH, errors, value);
    if (value.phone) {
      const digits = value.phone.replace(/\D/g, '').length;
      if (!PHONE_PATTERN.test(value.phone) || digits < 7 || digits > 15) {
        errors.phone = 'Phone is invalid';
      }
    }
  }
  if (input.institution !== undefined) {
    optionalText(input, 'institution', 'Institution', PROFILE_INSTITUTION_MAX_LENGTH, errors, value);
  }
  if (input.fieldOfStudy !== undefined) {
    optionalText(input, 'fieldOfStudy', 'Field of study', PROFILE_FIELD_OF_STUDY_MAX_LENGTH, errors, value);
  }
  if (input.bio !== undefined) {
    optionalText(input, 'bio', 'Bio', PROFILE_BIO_MAX_LENGTH, errors, value);
  }

  if (input.studyLevel !== undefined) {
    if (input.studyLevel === null || input.studyLevel === '') {
      value.studyLevel = null;
    } else if (!STUDY_LEVELS.includes(input.studyLevel)) {
      errors.studyLevel = `Study level must be one of: ${STUDY_LEVELS.join(', ')}`;
    } else {
      value.studyLevel = input.studyLevel;
    }
  }

  if (input.graduationYear !== undefined) {
    const raw = input.graduationYear;
    if (raw === null || raw === '') {
      value.graduationYear = null;
    } else {
      const year = typeof raw === 'string' && /^\d{1,4}$/.test(raw.trim()) ? Number(raw) : raw;
      if (!Number.isInteger(year) || year < GRADUATION_YEAR_MIN || year > GRADUATION_YEAR_MAX) {
        errors.graduationYear = `Graduation year must be between ${GRADUATION_YEAR_MIN} and ${GRADUATION_YEAR_MAX}`;
      } else {
        value.graduationYear = year;
      }
    }
  }

  if (input.avatarUrl !== undefined) {
    optionalImageUrl(input, 'avatarUrl', 'Avatar URL', errors, value);
  }

  return finish(errors, value, true);
}

function validateRoleChange(body) {
  const { role } = body || {};
  if (!ROLES.includes(role)) {
    return { errors: { role: `Role must be one of: ${ROLES.join(', ')}` } };
  }
  return { value: { role } };
}

// ---------------------------------------------------------------------------
// Fitness leads (public enquiry form)
//
// Limits match the fitness_leads columns and CHECK constraints.
// ---------------------------------------------------------------------------

const LEAD_TEXT_MAX_LENGTH = 2000;
const LEAD_MESSAGE_MAX_LENGTH = 5000;
const PHONE_MAX_LENGTH = 30;
// Digits with optional leading +, spaces, dots, dashes and parentheses;
// 7 to 15 digits in total. Matches the Fitness form.
const PHONE_PATTERN = /^\+?[\d\s().-]+$/;

// [field, label, maxLength]
const LEAD_REQUIRED_FIELDS = [
  ['businessName', 'Business name', 200],
  ['contactName', 'Contact person', 150],
  ['businessType', 'Business type', 100],
  ['location', 'Location', 200],
  ['servicesOffered', 'Services offered', LEAD_TEXT_MAX_LENGTH],
  ['marketingRequirements', 'Current marketing requirements', LEAD_TEXT_MAX_LENGTH],
  ['marketingObjectives', 'Marketing objectives', LEAD_TEXT_MAX_LENGTH],
];

const LEAD_OPTIONAL_FIELDS = [
  ['websiteLinks', 'Website / social media links', LEAD_TEXT_MAX_LENGTH],
  ['message', 'Additional requirements', LEAD_MESSAGE_MAX_LENGTH],
];

function validateFitnessLead(body) {
  const input = body || {};
  const errors = {};
  const value = {};

  for (const [field, label, maxLength] of LEAD_REQUIRED_FIELDS) {
    requiredText(input, field, label, maxLength, errors, value);
  }

  validateEmail(input.email, errors);
  if (!errors.email) {
    value.email = normalizeEmail(input.email);
  }

  // Missing optional fields are stored as null.
  for (const [field, label, maxLength] of LEAD_OPTIONAL_FIELDS) {
    if (input[field] === undefined) {
      value[field] = null;
    } else {
      optionalText(input, field, label, maxLength, errors, value);
    }
  }

  if (input.phone === undefined) {
    value.phone = null;
  } else {
    optionalText(input, 'phone', 'Phone', PHONE_MAX_LENGTH, errors, value);
    if (value.phone) {
      const digits = value.phone.replace(/\D/g, '').length;
      if (!PHONE_PATTERN.test(value.phone) || digits < 7 || digits > 15) {
        errors.phone = 'Phone is invalid';
      }
    }
  }

  // Unknown fields are ignored.
  return finish(errors, value, false);
}

// ---------------------------------------------------------------------------
// Eduyarp
//
// Limits match the Eduyarp tables in 003_eduyarp.sql. Same { partial: true }
// behaviour as the admin validators above.
// ---------------------------------------------------------------------------

const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced'];
const COURSE_STATUSES = ['draft', 'published', 'archived'];
const CLASS_STATUSES = ['scheduled', 'completed', 'cancelled'];
const TITLE_MAX_LENGTH = 200;
const COURSE_TEXT_MAX_LENGTH = 5000;
const DURATION_MAX_LENGTH = 100;
const DISPLAY_ORDER_MAX = 100000;
// NUMERIC(10,2): up to 8 whole digits and 2 decimals.
const FEE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;
// ISO 8601 date-time with an explicit offset, so the stored instant never
// depends on the server's time zone.
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function requiredChoice(input, field, label, choices, errors, value) {
  if (!choices.includes(input[field])) {
    errors[field] = `${label} must be one of: ${choices.join(', ')}`;
  } else {
    value[field] = input[field];
  }
}

function requiredId(input, field, label, errors, value) {
  const id = parseId(input[field]);
  if (id === null) {
    errors[field] = `${label} must be a positive integer`;
  } else {
    value[field] = id;
  }
}

function optionalDisplayOrder(input, errors, value) {
  const order = input.displayOrder;
  if (!Number.isInteger(order) || order < 0 || order > DISPLAY_ORDER_MAX) {
    errors.displayOrder = `displayOrder must be a whole number from 0 to ${DISPLAY_ORDER_MAX}`;
  } else {
    value.displayOrder = order;
  }
}

function validateCourse(body, { partial = false } = {}) {
  const input = body || {};
  const errors = {};
  const value = {};
  const has = (field) => !partial || input[field] !== undefined;

  if (has('title')) {
    requiredText(input, 'title', 'Title', TITLE_MAX_LENGTH, errors, value);
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
    optionalText(input, 'description', 'Description', COURSE_TEXT_MAX_LENGTH, errors, value);
  }
  if (input.learningObjectives !== undefined) {
    optionalText(input, 'learningObjectives', 'Learning objectives', COURSE_TEXT_MAX_LENGTH, errors, value);
  }
  if (input.duration !== undefined) {
    optionalText(input, 'duration', 'Duration', DURATION_MAX_LENGTH, errors, value);
  }

  if (has('level')) {
    requiredChoice(input, 'level', 'Level', COURSE_LEVELS, errors, value);
  }

  // Accepts a number or a numeric string; stored as NUMERIC, so kept as a string.
  if (has('fee')) {
    const raw = typeof input.fee === 'number' ? String(input.fee) : input.fee;
    const fee = typeof raw === 'string' ? raw.trim() : '';
    if (fee === '') {
      errors.fee = 'Fee is required';
    } else if (!FEE_PATTERN.test(fee)) {
      errors.fee = 'Fee must be a non-negative amount with at most 2 decimal places';
    } else {
      value.fee = fee;
    }
  }

  if (input.status !== undefined) {
    requiredChoice(input, 'status', 'Status', COURSE_STATUSES, errors, value);
  }

  if (input.coverImageUrl !== undefined) {
    optionalImageUrl(input, 'coverImageUrl', 'Cover image URL', errors, value);
  }
  if (input.iconUrl !== undefined) {
    optionalImageUrl(input, 'iconUrl', 'Course icon URL', errors, value);
  }

  return finish(errors, value, partial);
}

// Shared by modules and topics. Only topics accept videoUrl (a YouTube or
// Vimeo URL, or null to remove it).
function validateCurriculumItem(body, { partial = false, allowVideo = false } = {}) {
  const input = body || {};
  const errors = {};
  const value = {};

  if (!partial || input.title !== undefined) {
    requiredText(input, 'title', 'Title', TITLE_MAX_LENGTH, errors, value);
  }
  if (input.description !== undefined) {
    optionalText(input, 'description', 'Description', DESCRIPTION_MAX_LENGTH, errors, value);
  }
  if (input.displayOrder !== undefined) {
    optionalDisplayOrder(input, errors, value);
  }
  if (allowVideo && input.videoUrl !== undefined) {
    optionalText(input, 'videoUrl', 'Video URL', VIDEO_URL_MAX_LENGTH, errors, value);
    if (!errors.videoUrl && value.videoUrl !== null && !parseVideoUrl(value.videoUrl)) {
      errors.videoUrl = 'Video URL must be a YouTube or Vimeo video link';
    }
  }

  return finish(errors, value, partial);
}

// The only supported change is cancellation.
function validateEnrolmentUpdate(body) {
  if ((body || {}).status !== 'cancelled') {
    return { errors: { status: "Status must be 'cancelled'" } };
  }
  return { value: { status: 'cancelled' } };
}

function validateTrainerAssignment(body) {
  const errors = {};
  const value = {};
  requiredId(body || {}, 'trainerId', 'trainerId', errors, value);
  return finish(errors, value, false);
}

function validateClass(body, { partial = false } = {}) {
  const input = body || {};
  const errors = {};
  const value = {};
  const has = (field) => !partial || input[field] !== undefined;

  if (has('courseId')) {
    requiredId(input, 'courseId', 'courseId', errors, value);
  }
  if (has('trainerId')) {
    requiredId(input, 'trainerId', 'trainerId', errors, value);
  }
  if (has('title')) {
    requiredText(input, 'title', 'Title', TITLE_MAX_LENGTH, errors, value);
  }

  if (has('scheduledAt')) {
    const raw = input.scheduledAt;
    if (typeof raw !== 'string' || raw.trim() === '') {
      errors.scheduledAt = 'Date and time are required';
    } else if (!DATE_TIME_PATTERN.test(raw.trim()) || Number.isNaN(Date.parse(raw.trim()))) {
      errors.scheduledAt = 'Date and time must be an ISO 8601 value with a time zone';
    } else {
      value.scheduledAt = new Date(raw.trim()).toISOString();
    }
  }

  // null or an empty string clears the link.
  if (input.meetingLink !== undefined) {
    optionalText(input, 'meetingLink', 'Meeting link', URL_MAX_LENGTH, errors, value);
    if (value.meetingLink && !isHttpUrl(value.meetingLink)) {
      errors.meetingLink = 'Meeting link must be a valid http:// or https:// address';
    }
  }

  if (input.status !== undefined) {
    requiredChoice(input, 'status', 'Status', CLASS_STATUSES, errors, value);
  }

  return finish(errors, value, partial);
}

const ANNOUNCEMENT_BODY_MAX_LENGTH = 3000;

// courseId is only read when `allowCourseId` is set (Admin); a Trainer's course always
// comes from the URL. null or a missing courseId means platform-wide.
function validateAnnouncement(body, { allowCourseId = false } = {}) {
  const input = body || {};
  const errors = {};
  const value = {};
  requiredText(input, 'title', 'Title', TITLE_MAX_LENGTH, errors, value);
  requiredText(input, 'body', 'Message', ANNOUNCEMENT_BODY_MAX_LENGTH, errors, value);
  if (allowCourseId) {
    if (input.courseId === undefined || input.courseId === null) {
      value.courseId = null;
    } else {
      requiredId(input, 'courseId', 'courseId', errors, value);
    }
  }
  return finish(errors, value, false);
}

// Query string for the notification list: limit 1-100 (default 20), offset >= 0, unread true/false.
function validateNotificationQuery(query) {
  const errors = {};
  const value = { limit: 20, offset: 0, unread: false };
  const whole = (raw) => (typeof raw === 'string' && /^\d{1,9}$/.test(raw) ? Number(raw) : null);
  if (query.limit !== undefined) {
    const limit = whole(query.limit);
    if (limit === null || limit < 1 || limit > 100) errors.limit = 'limit must be a whole number from 1 to 100';
    else value.limit = limit;
  }
  if (query.offset !== undefined) {
    const offset = whole(query.offset);
    if (offset === null) errors.offset = 'offset must be a whole number of 0 or more';
    else value.offset = offset;
  }
  if (query.unread !== undefined) {
    if (query.unread === 'true') value.unread = true;
    else if (query.unread !== 'false') errors.unread = 'unread must be true or false';
  }
  return finish(errors, value, false);
}

// The host must follow "//" directly (so "http:///x" is not read as http://x).
function requireUrlHost(value, field, label, errors) {
  if (value[field] && !/^https?:\/\/[^\s/?#\\]/i.test(value[field])) {
    delete value[field];
    errors[field] = `${label} must be a valid http:// or https:// address`;
  }
}

const FAQ_QUESTION_MAX_LENGTH = 500;
const FAQ_ANSWER_MAX_LENGTH = 3000;
const RESOURCE_DESCRIPTION_MAX_LENGTH = 1000;
const RESOURCE_TYPES = ['video', 'pdf', 'document', 'presentation', 'external'];

function validateFaq(body, { partial = false } = {}) {
  const input = body || {};
  const errors = {};
  const value = {};
  const has = (field) => !partial || input[field] !== undefined;
  if (has('question')) requiredText(input, 'question', 'Question', FAQ_QUESTION_MAX_LENGTH, errors, value);
  if (has('answer')) requiredText(input, 'answer', 'Answer', FAQ_ANSWER_MAX_LENGTH, errors, value);
  if (input.displayOrder !== undefined) optionalDisplayOrder(input, errors, value);
  return finish(errors, value, partial);
}

// moduleId / topicId: a valid id, or null to clear. Whether they belong to the course
// is checked against the database by the service.
function optionalLinkId(input, field, errors, value) {
  if (input[field] === undefined) return;
  if (input[field] === null || input[field] === '') {
    value[field] = null;
    return;
  }
  const id = parseId(input[field]);
  if (id === null) errors[field] = `${field} must be a positive integer or null`;
  else value[field] = id;
}

function validateResource(body, { partial = false } = {}) {
  const input = body || {};
  const errors = {};
  const value = {};
  const has = (field) => !partial || input[field] !== undefined;
  if (has('title')) requiredText(input, 'title', 'Title', TITLE_MAX_LENGTH, errors, value);
  if (input.description !== undefined) {
    optionalText(input, 'description', 'Description', RESOURCE_DESCRIPTION_MAX_LENGTH, errors, value);
  }
  if (has('resourceType')) requiredChoice(input, 'resourceType', 'Type', RESOURCE_TYPES, errors, value);
  if (has('url')) {
    if (typeof input.url !== 'string' || input.url.trim() === '') {
      errors.url = 'Address is required';
    } else {
      optionalImageUrl(input, 'url', 'Address', errors, value);
      requireUrlHost(value, 'url', 'Address', errors);
    }
  }
  optionalLinkId(input, 'moduleId', errors, value);
  optionalLinkId(input, 'topicId', errors, value);
  if (input.displayOrder !== undefined) optionalDisplayOrder(input, errors, value);
  return finish(errors, value, partial);
}

// { ids: [...] } - the complete list of a course's FAQ ids in the wanted order.
function validateReorder(body) {
  const ids = body && body.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
    return { errors: { ids: 'ids must be a list of 1 to 500 ids' } };
  }
  const parsed = ids.map(parseId);
  if (parsed.some((id) => id === null) || new Set(parsed).size !== parsed.length) {
    return { errors: { ids: 'ids must be unique positive integers' } };
  }
  return { value: { ids: parsed } };
}

const ASSIGNMENT_INSTRUCTIONS_MAX_LENGTH = 5000;
const SUBMISSION_TEXT_MAX_LENGTH = 5000;
const FEEDBACK_MAX_LENGTH = 3000;
const ASSIGNMENT_STATUSES = ['draft', 'published', 'closed'];

function validateAssignment(body, { partial = false } = {}) {
  const input = body || {};
  const errors = {};
  const value = {};
  const has = (field) => !partial || input[field] !== undefined;
  if (has('title')) requiredText(input, 'title', 'Title', TITLE_MAX_LENGTH, errors, value);
  if (has('instructions')) {
    requiredText(input, 'instructions', 'Instructions', ASSIGNMENT_INSTRUCTIONS_MAX_LENGTH, errors, value);
  }
  if (input.status !== undefined) requiredChoice(input, 'status', 'Status', ASSIGNMENT_STATUSES, errors, value);
  // null or an empty string removes the due date.
  if (input.dueAt !== undefined) {
    const raw = input.dueAt;
    if (raw === null || raw === '') {
      value.dueAt = null;
    } else if (typeof raw !== 'string' || !DATE_TIME_PATTERN.test(raw.trim()) || Number.isNaN(Date.parse(raw.trim()))) {
      errors.dueAt = 'Due date must be an ISO 8601 value with a time zone, or null';
    } else {
      value.dueAt = new Date(raw.trim()).toISOString();
    }
  }
  optionalLinkId(input, 'moduleId', errors, value);
  optionalLinkId(input, 'topicId', errors, value);
  if (input.displayOrder !== undefined) optionalDisplayOrder(input, errors, value);
  return finish(errors, value, partial);
}

// A submission needs text, a link, or both. Blank values count as missing.
function validateSubmission(body) {
  const input = body || {};
  const errors = {};
  const value = {};
  if (input.text !== undefined && input.text !== null) {
    if (typeof input.text !== 'string') {
      errors.text = 'Text must be a string';
    } else if (input.text.trim().length > SUBMISSION_TEXT_MAX_LENGTH) {
      errors.text = `Text must be at most ${SUBMISSION_TEXT_MAX_LENGTH} characters`;
    } else if (input.text.trim() !== '') {
      value.text = input.text.trim();
    }
  }
  if (input.url !== undefined && input.url !== null) {
    if (typeof input.url !== 'string') {
      errors.url = 'Link must be a string';
    } else if (input.url.trim() !== '') {
      const urlValue = {};
      optionalImageUrl({ url: input.url }, 'url', 'Link', errors, urlValue);
      requireUrlHost(urlValue, 'url', 'Link', errors);
      if (urlValue.url) value.url = urlValue.url;
    }
  }
  if (Object.keys(errors).length === 0 && value.text === undefined && value.url === undefined) {
    errors.text = 'Write an answer or add a link';
  }
  return finish(errors, value, false);
}

function validateFeedback(body) {
  const input = body || {};
  const errors = {};
  const value = {};
  requiredText(input, 'feedback', 'Feedback', FEEDBACK_MAX_LENGTH, errors, value);
  return finish(errors, value, false);
}

function validateRevocation(body) {
  const input = body || {};
  const errors = {};
  const value = {};
  requiredText(input, 'reason', 'Reason', 500, errors, value);
  return finish(errors, value, false);
}

// Query string filters for the Admin certificate list.
function validateCertificateFilters(query) {
  const errors = {};
  const value = {};
  for (const field of ['courseId', 'studentId']) {
    if (query[field] !== undefined && query[field] !== '') {
      const id = parseId(query[field]);
      if (id === null) errors[field] = `${field} must be a positive integer`;
      else value[field] = id;
    }
  }
  if (query.status !== undefined && query.status !== '') {
    if (['active', 'revoked'].includes(query.status)) value.status = query.status;
    else errors.status = 'status must be active or revoked';
  }
  return finish(errors, value, false);
}

module.exports = {
  validateRegistration,
  validateLogin,
  parseId,
  validatePlatform,
  validateService,
  validatePasswordChange,
  validateProfile,
  validateRoleChange,
  validateFitnessLead,
  validateCourse,
  validateCurriculumItem,
  validateTrainerAssignment,
  validateEnrolmentUpdate,
  validateClass,
  validateAnnouncement,
  validateNotificationQuery,
  validateFaq,
  validateResource,
  validateReorder,
  validateAssignment,
  validateSubmission,
  validateFeedback,
  validateRevocation,
  validateCertificateFilters,
};
