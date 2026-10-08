const notificationService = require('../services/notification.service');
const { validateNotificationQuery } = require('../utils/validators');
const { getIdParam, requireValid } = require('./helpers');

// The recipient is always req.user; no id of a user is ever read from the request.

async function list(req, res) {
  const query = requireValid(validateNotificationQuery(req.query));
  res.json(await notificationService.listNotifications(req.user.id, query));
}

async function markRead(req, res) {
  res.json(await notificationService.markRead(req.user.id, getIdParam(req)));
}

async function markAllRead(req, res) {
  res.json(await notificationService.markAllRead(req.user.id));
}

module.exports = { list, markRead, markAllRead };
