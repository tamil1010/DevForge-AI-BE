const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getProblems,
  getProblem,
  runCode,
  submitCode,
  getSubmissions,
  getContests,
  getContest,
  registerContest,
  getContestLeaderboard,
  getLeaderboard,
  getProfile,
  aiAssist,
  getEditorial,
  getDiscussions,
  createDiscussion,
  addComment,
  upvoteDiscussion,
  adminCreateProblem,
  adminUpdateProblem,
  adminDeleteProblem,
  adminCreateContest
} = require('../controllers/codeArenaController');
const { protect } = require('../middleware/authMiddleware');

// Public or optionally authenticated routes
router.get('/dashboard', protect, getDashboard);
router.get('/problems', protect, getProblems);
router.get('/problems/:id', protect, getProblem);
router.get('/problems/:id/editorial', protect, getEditorial);
router.get('/problems/:id/discussions', protect, getDiscussions);

router.post('/run', protect, runCode);
router.post('/submit', protect, submitCode);
router.post('/problems/:id/run', protect, runCode);
router.post('/problems/:id/submit', protect, submitCode);
router.get('/submissions', protect, getSubmissions);

router.get('/contests', protect, getContests);
router.get('/contests/:id', protect, getContest);
router.post('/contests/:id/register', protect, registerContest);
router.get('/contests/:id/leaderboard', protect, getContestLeaderboard);

router.get('/leaderboard', protect, getLeaderboard);
router.get('/profile', protect, getProfile);
router.get('/profile/:userId', protect, getProfile);

router.post('/ai-assist', protect, aiAssist);

router.post('/problems/:id/discussions', protect, createDiscussion);
router.post('/discussions/:id/comments', protect, addComment);
router.post('/discussions/:id/upvote', protect, upvoteDiscussion);

// Admin Routes
router.post('/admin/problems', protect, adminCreateProblem);
router.put('/admin/problems/:id', protect, adminUpdateProblem);
router.delete('/admin/problems/:id', protect, adminDeleteProblem);
router.post('/admin/contests', protect, adminCreateContest);

module.exports = router;
