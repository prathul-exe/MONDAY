const express = require('express');

const router = express.Router();

function compareSemver(a = '0.0.0', b = '0.0.0') {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

// GET /api/system/version?currentVersion=1.0.0
router.get('/version', (req, res) => {
  const currentVersion = req.query.currentVersion || req.headers['x-app-version'] || '1.0.0';
  const latestAppVersion = process.env.LATEST_APP_VERSION || '1.0.0';
  const minSupportedAppVersion = process.env.MIN_SUPPORTED_APP_VERSION || '1.0.0';
  const playStoreUrl = process.env.PLAY_STORE_URL || 'https://play.google.com/store/apps';

  const updateAvailable = compareSemver(latestAppVersion, currentVersion) > 0;
  const forceUpdate = compareSemver(minSupportedAppVersion, currentVersion) > 0;

  res.json({
    apiVersion: '1.0.0',
    currentVersion,
    latestAppVersion,
    minSupportedAppVersion,
    updateAvailable,
    forceUpdate,
    playStoreUrl,
    releaseNotes: process.env.RELEASE_NOTES || 'Latest stability and attendance engine improvements.'
  });
});

module.exports = router;
module.exports.compareSemver = compareSemver;
