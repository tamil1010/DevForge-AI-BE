const express = require('express');
const router = express.Router();
const {
  analyzeRequirement,
  saveEntities,
  saveRelationships,
  generateSchema,
  generateSql,
  validateSchema,
  safeAutoFix,
  reviewAi,
  getIndexRecommendations
} = require('../controllers/databaseController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/analyze', analyzeRequirement);
router.post('/save-entities', saveEntities);
router.post('/save-relationships', saveRelationships);
router.post('/generate-schema', generateSchema);
router.post('/generate-sql', generateSql);
router.post('/validate', validateSchema);
router.post('/safe-autofix', safeAutoFix);
router.post('/review-ai', reviewAi);
router.get('/indexes/:projectId', getIndexRecommendations);

module.exports = router;
