const publicPlatformService = require('../services/publicPlatform.service');

async function list(req, res) {
  const platforms = await publicPlatformService.listActivePlatforms();
  res.json({ platforms });
}

module.exports = {
  list,
};
