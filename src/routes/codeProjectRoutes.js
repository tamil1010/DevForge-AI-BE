const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProject,
  createProject,
  generateForDbProject,
  saveFile,
  getChatHistory,
  sendChatMessage,
  getVersions,
  reviewCode,
  scanSecurity,
  generateTests,
  getDocs,
  scanDependencies,
  exportProject,
  deleteProject
} = require('../controllers/codeProjectController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getProjects);
router.post('/', createProject);
router.post('/generate-for-db-project', generateForDbProject);

router.get('/:id', getProject);
router.delete('/:id', deleteProject);
router.post('/:id/files', saveFile);
router.get('/:id/chats', getChatHistory);
router.post('/:id/chats', sendChatMessage);
router.get('/:id/versions', getVersions);
router.get('/:id/review', reviewCode);
router.get('/:id/security-scan', scanSecurity);
router.post('/:id/generate-tests', generateTests);
router.get('/:id/docs', getDocs);
router.get('/:id/dependencies', scanDependencies);
router.get('/:id/export', exportProject);

module.exports = router;

