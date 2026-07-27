const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  duplicateProject,
  deleteProject
} = require('../controllers/projectController');
const { getAiReviews, reviewAi, modifyAi } = require('../controllers/databaseController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getProjects);
router.get('/:id', getProject);
router.get('/:projectId/ai-reviews', getAiReviews);
router.post('/review-ai', reviewAi);
router.post('/modify-ai', modifyAi);
router.post('/:projectId/modify-ai', modifyAi);
router.post('/', createProject);
router.put('/:id', updateProject);
router.post('/:id/duplicate', duplicateProject);
router.delete('/:id', deleteProject);

module.exports = router;
