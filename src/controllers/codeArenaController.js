const codeArenaService = require('../services/codeArenaService');
const codeArenaAiService = require('../services/codeArenaAiService');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');

// 1. Dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user.id : 1;
  const username = req.user ? req.user.full_name : 'Demo Architect';
  const data = await codeArenaService.getDashboard(userId, username);
  res.status(200).json({ success: true, data });
});

// 2. Problems
const getProblems = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user.id : 1;
  const { page = 1, limit = 15, search = '', difficulty = 'ALL', category = 'ALL', language = 'ALL', status = 'ALL' } = req.query;
  const result = await codeArenaService.getProblems({ page, limit, search, difficulty, category, language, status, userId });
  res.status(200).json({ success: true, ...result });
});

const getProblem = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user.id : 1;
  const problem = await codeArenaService.getProblemById(req.params.id, userId);
  if (!problem) throw new ApiError(404, 'Problem not found');
  res.status(200).json({ success: true, data: problem });
});

// 3. Execution (Run & Submit)
const runCode = asyncHandler(async (req, res) => {
  const problemId = req.params.id || req.body.problemId || req.body.problem_id;
  const code = req.body.code || req.body.source_code;
  const language = req.body.language;
  const customInput = req.body.customInput || req.body.custom_input;
  if (!problemId || !code) throw new ApiError(400, 'problemId and code are required');
  const result = await codeArenaService.runCode({ problemId, code, language, customInput });
  res.status(200).json({ success: true, data: result });
});

const submitCode = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user.id : 1;
  const username = req.user ? req.user.full_name : 'Demo Architect';
  const problemId = req.params.id || req.body.problemId || req.body.problem_id;
  const code = req.body.code || req.body.source_code;
  const language = req.body.language;
  const contestId = req.body.contestId || req.body.contest_id;
  if (!problemId || !code) throw new ApiError(400, 'problemId and code are required');

  const io = req.app.get('io');
  const submission = await codeArenaService.submitCode({
    problemId,
    code,
    language,
    userId,
    username,
    contestId,
    io
  });
  res.status(201).json({ success: true, data: submission });
});

const getSubmissions = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user.id : 1;
  const { problemId } = req.query;
  const submissions = await codeArenaService.getSubmissions({ userId, problemId });
  res.status(200).json({ success: true, data: submissions });
});

// 4. Contests
const getContests = asyncHandler(async (req, res) => {
  const contests = await codeArenaService.getContests();
  res.status(200).json({ success: true, data: contests });
});

const getContest = asyncHandler(async (req, res) => {
  const contest = await codeArenaService.getContestById(req.params.id);
  if (!contest) throw new ApiError(404, 'Contest not found');
  res.status(200).json({ success: true, data: contest });
});

const registerContest = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user.id : 1;
  const username = req.user ? req.user.full_name : 'Demo Architect';
  const result = await codeArenaService.registerForContest(req.params.id, userId, username);
  res.status(200).json(result);
});

const getContestLeaderboard = asyncHandler(async (req, res) => {
  const leaderboard = await codeArenaService.getContestLeaderboard(req.params.id);
  res.status(200).json({ success: true, data: leaderboard });
});

// 5. Global Leaderboard
const getLeaderboard = asyncHandler(async (req, res) => {
  const { filter = 'global' } = req.query;
  const leaderboard = await codeArenaService.getLeaderboard({ filter });
  res.status(200).json({ success: true, data: leaderboard });
});

// 6. Profile & Analytics
const getProfile = asyncHandler(async (req, res) => {
  const userId = req.params.userId || (req.user ? req.user.id : 1);
  const username = req.user ? req.user.full_name : 'Demo Architect';
  const profileData = await codeArenaService.getUserProfile(userId, username);
  res.status(200).json({ success: true, data: profileData });
});

// 7. AI Assistant
const aiAssist = asyncHandler(async (req, res) => {
  const { type, problemId, code, language, error, testResult, level, isContest } = req.body;
  const problem = await codeArenaService.getProblemById(problemId, req.user?.id);
  if (!problem) throw new ApiError(404, 'Problem not found');

  let result = null;
  switch (type) {
    case 'explain':
      result = await codeArenaAiService.explainProblem({ problem });
      break;
    case 'hint':
      result = await codeArenaAiService.getHint({ problem, level, userCode: code, isContest });
      break;
    case 'explain_error':
      result = await codeArenaAiService.explainError({ problem, code, language, error, testResult });
      break;
    case 'complexity':
      result = await codeArenaAiService.analyzeComplexity({ problem, code, language });
      break;
    case 'review':
      result = await codeArenaAiService.reviewCode({ problem, code, language });
      break;
    case 'optimize':
      result = await codeArenaAiService.optimizeCode({ problem, code, language, isContest });
      break;
    default:
      throw new ApiError(400, `Unknown AI assistance type: ${type}`);
  }

  res.status(200).json(result);
});

// 8. Editorial & Discussions
const getEditorial = asyncHandler(async (req, res) => {
  const { isContest } = req.query;
  const editorial = await codeArenaService.getEditorial(req.params.id, Boolean(isContest));
  res.status(200).json({ success: true, data: editorial });
});

const getDiscussions = asyncHandler(async (req, res) => {
  const discussions = await codeArenaService.getDiscussions(req.params.id);
  res.status(200).json({ success: true, data: discussions });
});

const createDiscussion = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user.id : 1;
  const userName = req.user ? req.user.full_name : 'Demo Architect';
  const { title, content, tags } = req.body;
  if (!title || !content) throw new ApiError(400, 'Title and content are required');
  const discussion = await codeArenaService.createDiscussion({
    problemId: req.params.id,
    userId,
    userName,
    title,
    content,
    tags
  });
  res.status(201).json({ success: true, data: discussion });
});

const addComment = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user.id : 1;
  const userName = req.user ? req.user.full_name : 'Demo Architect';
  const { content } = req.body;
  if (!content) throw new ApiError(400, 'Content is required');
  const comment = await codeArenaService.addComment({
    discussionId: req.params.id,
    userId,
    userName,
    content
  });
  res.status(201).json({ success: true, data: comment });
});

const upvoteDiscussion = asyncHandler(async (req, res) => {
  const disc = await codeArenaService.upvoteDiscussion(req.params.id);
  res.status(200).json({ success: true, data: disc });
});

// 9. Admin Operations
const adminCreateProblem = asyncHandler(async (req, res) => {
  const problem = await codeArenaService.adminCreateProblem(req.body);
  res.status(201).json({ success: true, data: problem });
});

const adminUpdateProblem = asyncHandler(async (req, res) => {
  const problem = await codeArenaService.adminUpdateProblem(req.params.id, req.body);
  res.status(200).json({ success: true, data: problem });
});

const adminDeleteProblem = asyncHandler(async (req, res) => {
  const result = await codeArenaService.adminDeleteProblem(req.params.id);
  res.status(200).json(result);
});

const adminCreateContest = asyncHandler(async (req, res) => {
  const contest = await codeArenaService.adminCreateContest(req.body);
  res.status(201).json({ success: true, data: contest });
});

module.exports = {
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
};
