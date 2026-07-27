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
  getAiReviews,
  deleteAiReview,
  clearAiReviews,
  modifyAi,
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
router.post('/modify-ai', modifyAi);
router.post('/:projectId/modify-ai', modifyAi);
router.get('/ai-reviews/:projectId', getAiReviews);
router.delete('/ai-reviews/clear/:projectId', clearAiReviews);
router.delete('/ai-reviews/:id', deleteAiReview);
router.get('/indexes/:projectId', getIndexRecommendations);

module.exports = router;
