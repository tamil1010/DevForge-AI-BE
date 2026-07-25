const express = require('express');
const router = express.Router();
const {
  getVersions,
  createVersion,
  compareProjectVersions,
  restoreVersion
} = require('../controllers/versionController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/:projectId', getVersions);
router.post('/:projectId', createVersion);
router.get('/:projectId/compare', compareProjectVersions);
router.post('/:projectId/restore/:versionNumber', restoreVersion);

module.exports = router;
