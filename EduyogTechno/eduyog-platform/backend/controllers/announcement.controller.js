const announcementService = require('../services/announcement.service');
const { validateAnnouncement } = require('../utils/validators');
const HttpError = require('../utils/httpError');
const { getIdParam, requireValid } = require('./helpers');

// Trainer: the actor is always req.user and the course comes from the URL; the
// service re-checks the assignment on every call.

async function listForCourse(req, res) {
  const announcements = await announcementService.listForCourse(req.user, getIdParam(req, 'courseId'));
  res.json({ announcements });
}

async function createForCourse(req, res) {
  const input = requireValid(validateAnnouncement(req.body));
  const announcement = await announcementService.createForCourse(req.user, getIdParam(req, 'courseId'), input);
  res.status(201).json({ announcement });
}

async function deleteAsTrainer(req, res) {
  await announcementService.deleteAsTrainer(req.user, getIdParam(req));
  res.status(204).end();
}

// Admin (behind authenticate + requireAdmin).

async function listForAdmin(req, res) {
  const filter = {};
  if (req.query.courseId !== undefined) {
    // getIdParam reads req.params; reuse the same id rules for the query value.
    filter.courseId = getIdParam({ params: { courseId: req.query.courseId } }, 'courseId');
  } else if (req.query.scope === 'platform') {
    filter.platformOnly = true;
  } else if (req.query.scope !== undefined) {
    throw new HttpError(400, 'Invalid scope');
  }
  res.json({ announcements: await announcementService.listForAdmin(filter) });
}

async function createAsAdmin(req, res) {
  const input = requireValid(validateAnnouncement(req.body, { allowCourseId: true }));
  const announcement = await announcementService.createAsAdmin(req.user, input);
  res.status(201).json({ announcement });
}

async function deleteAsAdmin(req, res) {
  await announcementService.deleteAsAdmin(getIdParam(req));
  res.status(204).end();
}

// Signed-in Student or Trainer: announcements delivered to them.
async function listMine(req, res) {
  res.json({ announcements: await announcementService.listForUser(req.user) });
}

module.exports = {
  listForCourse,
  createForCourse,
  deleteAsTrainer,
  listForAdmin,
  createAsAdmin,
  deleteAsAdmin,
  listMine,
};
