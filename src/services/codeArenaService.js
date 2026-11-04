const { seedProblems } = require('../data/seedProblems');
const { seedContests, seedLeaderboard } = require('../data/seedContests');
const { executeCode, evaluateTestCases } = require('./judge0Service');

// State Storage for CodeArena
const state = {
  problems: JSON.parse(JSON.stringify(seedProblems)),
  contests: JSON.parse(JSON.stringify(seedContests)),
  leaderboard: JSON.parse(JSON.stringify(seedLeaderboard)),
  submissions: [],
  userStats: {},
  contestParticipants: {},
  discussions: [
    {
      id: 'disc-1',
      problem_id: 'two-sum',
      user_id: 101,
      user_name: 'neocortex_dev',
      title: 'Why One-Pass Hash Map is O(n) and optimal',
      content: 'Using a hash map allows us to check for the complement in average O(1) time. In C++ use unordered_map, in Python dict, in JS Map. Be mindful of hash collisions in extreme adversarial test cases.',
      upvotes: 42,
      tags: ['Hash Map', 'Optimization', 'Interview Tips'],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      comments: [
        {
          id: 'comm-1',
          user_id: 102,
          user_name: 'algo_sorcerer',
          content: 'Great explanation! Also note that two pointers works in O(n log n) if the array is unsorted.',
          created_at: new Date(Date.now() - 86400000).toISOString()
        }
      ]
    },
    {
      id: 'disc-2',
      problem_id: 'maximum-subarray',
      user_id: 103,
      user_name: 'binary_blaze',
      title: 'Kadane algorithm visualization and proof of correctness',
      content: 'The core invariant: at every index i, we find the maximum subarray ending at i. Either it continues the previous subarray, or starts anew at nums[i].',
      upvotes: 28,
      tags: ['Dynamic Programming', 'Kadane', 'Proof'],
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      comments: []
    }
  ]
};

// Seed initial user stats for Demo User (id: 1)
state.userStats[1] = {
  user_id: 1,
  username: 'Demo Architect',
  rating: 1850,
  global_rank: 4,
  current_streak: 7,
  longest_streak: 15,
  total_solved: 6,
  easy_solved: 3,
  medium_solved: 2,
  hard_solved: 1,
  total_submissions: 18,
  accepted_submissions: 14,
  acceptance_rate: 77.8,
  badges: ['Specialist', 'First Solve', '7-Day Streak', 'Array Master'],
  solved_problem_ids: ['two-sum', 'valid-parentheses', 'palindrome-number', 'maximum-subarray', 'coin-change', 'trapping-rain-water']
};

// Helper: Get or initialize user stats
const getUserStats = (userId, username = 'Developer') => {
  if (!state.userStats[userId]) {
    state.userStats[userId] = {
      user_id: userId,
      username,
      rating: 1200,
      global_rank: state.leaderboard.length + 1,
      current_streak: 1,
      longest_streak: 1,
      total_solved: 0,
      easy_solved: 0,
      medium_solved: 0,
      hard_solved: 0,
      total_submissions: 0,
      accepted_submissions: 0,
      acceptance_rate: 0,
      badges: ['Newbie', 'First Step'],
      solved_problem_ids: []
    };
  }
  return state.userStats[userId];
};

const codeArenaService = {
  // 1. Dashboard summary
  async getDashboard(userId, username) {
    const stats = getUserStats(userId, username);
    const recentSubmissions = state.submissions
      .filter(s => s.user_id == userId)
      .slice(0, 5);

    const activeContests = state.contests.filter(c => c.status === 'live');
    const upcomingContests = state.contests.filter(c => c.status === 'upcoming');

    // Recommended problems (unsolved medium/easy)
    const solvedSet = new Set(stats.solved_problem_ids || []);
    const recommended = state.problems
      .filter(p => !solvedSet.has(p.id))
      .slice(0, 4)
      .map(p => ({
        id: p.id,
        title: p.title,
        difficulty: p.difficulty,
        category: p.category,
        acceptance_rate: p.acceptance_rate,
        total_submissions: p.total_submissions
      }));

    return {
      stats: {
        total_solved: stats.total_solved,
        available_problems: state.problems.length,
        global_rank: stats.global_rank || 4,
        rating: stats.rating || 1850,
        current_streak: stats.current_streak || 7,
        longest_streak: stats.longest_streak || 15,
        total_submissions: stats.total_submissions,
        acceptance_rate: stats.acceptance_rate,
        easy_solved: stats.easy_solved,
        medium_solved: stats.medium_solved,
        hard_solved: stats.hard_solved
      },
      active_contests: activeContests,
      upcoming_contests: upcomingContests,
      recent_submissions: recentSubmissions,
      recommended_problems: recommended
    };
  },

  // 2. Problems list with filtering & pagination
  async getProblems({ page = 1, limit = 10, search = '', difficulty = 'ALL', category = 'ALL', language = 'ALL', status = 'ALL', userId }) {
    let filtered = [...state.problems];
    const user = getUserStats(userId);
    const solvedSet = new Set(user.solved_problem_ids || []);

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(p => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }

    if (difficulty && difficulty !== 'ALL') {
      filtered = filtered.filter(p => p.difficulty.toLowerCase() === difficulty.toLowerCase());
    }

    if (category && category !== 'ALL') {
      filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    if (language && language !== 'ALL') {
      filtered = filtered.filter(p => p.supported_languages && p.supported_languages.includes(language.toLowerCase()));
    }

    if (status && status !== 'ALL') {
      if (status === 'SOLVED') filtered = filtered.filter(p => solvedSet.has(p.id));
      if (status === 'UNSOLVED') filtered = filtered.filter(p => !solvedSet.has(p.id));
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const pageItems = filtered.slice(startIndex, startIndex + limit).map(p => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      category: p.category,
      acceptance_rate: p.acceptance_rate,
      total_submissions: p.total_submissions,
      supported_languages: p.supported_languages,
      is_solved: solvedSet.has(p.id)
    }));

    return {
      problems: pageItems,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(total / limit)
      }
    };
  },

  // 3. Problem detail (strips hidden test cases)
  async getProblemById(id, userId) {
    const problem = state.problems.find(p => p.id === id || p.slug === id);
    if (!problem) return null;

    const user = getUserStats(userId);
    const isSolved = user.solved_problem_ids?.includes(problem.id);

    // Get user's last submission for starter code if available
    const lastSub = state.submissions.find(s => s.problem_id === problem.id && s.user_id == userId);

    return {
      id: problem.id,
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      category: problem.category,
      acceptance_rate: problem.acceptance_rate,
      total_submissions: problem.total_submissions,
      time_limit_ms: problem.time_limit_ms,
      memory_limit_mb: problem.memory_limit_mb,
      description: problem.description,
      input_format: problem.input_format,
      output_format: problem.output_format,
      constraints: problem.constraints,
      supported_languages: problem.supported_languages,
      starter_templates: problem.starter_templates,
      sample_test_cases: problem.sample_test_cases,
      is_solved: Boolean(isSolved),
      hints_count: (problem.hints || []).length,
      last_code: lastSub ? lastSub.code : null,
      last_language: lastSub ? lastSub.language : null
    };
  },

  // 4. Run Code (Tests sample/custom inputs only)
  async runCode({ problemId, code, language, customInput }) {
    const problem = state.problems.find(p => p.id === problemId);
    if (!problem) throw new Error('Problem not found');

    let testCasesToRun = [];
    if (customInput !== undefined && customInput !== null && customInput.trim() !== '') {
      testCasesToRun = [{ input: customInput, expected_output: '', is_hidden: false }];
    } else {
      testCasesToRun = problem.sample_test_cases.map(st => ({
        input: st.input,
        expected_output: st.expected_output,
        is_hidden: false
      }));
    }

    const evalResult = await evaluateTestCases({
      code,
      language,
      testCases: testCasesToRun,
      timeLimitMs: problem.time_limit_ms,
      memoryLimitMb: problem.memory_limit_mb
    });

    return evalResult;
  },

  // 5. Submit Code (Evaluates sample + hidden test cases, updates stats)
  async submitCode({ problemId, code, language, userId, username, contestId, io }) {
    const problem = state.problems.find(p => p.id === problemId);
    if (!problem) throw new Error('Problem not found');

    const allTestCases = [
      ...problem.sample_test_cases.map(s => ({ ...s, is_hidden: false })),
      ...problem.hidden_test_cases.map(h => ({ ...h, is_hidden: true }))
    ];

    const evalResult = await evaluateTestCases({
      code,
      language,
      testCases: allTestCases,
      timeLimitMs: problem.time_limit_ms,
      memoryLimitMb: problem.memory_limit_mb
    });

    const isAccepted = evalResult.verdict === 'Accepted';

    const submission = {
      id: `sub_${Date.now()}`,
      problem_id: problem.id,
      problem_title: problem.title,
      contest_id: contestId || null,
      user_id: userId,
      user_name: username,
      language,
      code,
      status: evalResult.verdict,
      passed_test_cases: evalResult.passed_count,
      total_test_cases: evalResult.total_count,
      execution_time_ms: Math.round(evalResult.average_time * 1000),
      memory_kb: evalResult.peak_memory_kb,
      error_output: evalResult.first_failed_case?.error || null,
      first_failed_case: evalResult.first_failed_case,
      test_results: evalResult.test_results,
      created_at: new Date().toISOString()
    };

    state.submissions.unshift(submission);

    // Update problem stats
    problem.total_submissions++;
    if (isAccepted) problem.accepted_submissions++;
    problem.acceptance_rate = Number(((problem.accepted_submissions / problem.total_submissions) * 100).toFixed(1));

    // Update user stats
    const stats = getUserStats(userId, username);
    stats.total_submissions++;
    if (isAccepted) {
      stats.accepted_submissions++;
      if (!stats.solved_problem_ids.includes(problem.id)) {
        stats.solved_problem_ids.push(problem.id);
        stats.total_solved++;
        if (problem.difficulty === 'Easy') stats.easy_solved++;
        if (problem.difficulty === 'Medium') stats.medium_solved++;
        if (problem.difficulty === 'Hard') stats.hard_solved++;
        stats.rating = (stats.rating || 1200) + (problem.difficulty === 'Hard' ? 35 : problem.difficulty === 'Medium' ? 20 : 10);
      }
    }
    stats.acceptance_rate = Number(((stats.accepted_submissions / stats.total_submissions) * 100).toFixed(1));

    // Contest participation update
    if (contestId) {
      if (!state.contestParticipants[contestId]) state.contestParticipants[contestId] = {};
      const part = state.contestParticipants[contestId][userId] || {
        user_id: userId,
        user_name: username,
        score: 0,
        solved_count: 0,
        submissions_count: 0
      };
      part.submissions_count++;
      if (isAccepted && !part[problem.id]) {
        part[problem.id] = true;
        part.solved_count++;
        part.score += 100;
      }
      state.contestParticipants[contestId][userId] = part;
    }

    // Broadcast real-time leaderboard update via Socket.IO
    if (io) {
      io.emit('codearena:submission', {
        problem_id: problem.id,
        user_name: username,
        verdict: evalResult.verdict,
        timestamp: new Date().toISOString()
      });
      io.emit('codearena:leaderboard_update', state.leaderboard);
    }

    return submission;
  },

  // 6. Submissions history
  async getSubmissions({ userId, problemId }) {
    let list = [...state.submissions];
    if (userId) list = list.filter(s => s.user_id == userId);
    if (problemId) list = list.filter(s => s.problem_id === problemId);
    return list;
  },

  // 7. Contests
  async getContests() {
    return state.contests;
  },

  async getContestById(id) {
    const contest = state.contests.find(c => c.id === id);
    if (!contest) return null;
    const contestProblems = state.problems
      .filter(p => contest.problem_ids.includes(p.id))
      .map(p => ({
        id: p.id,
        title: p.title,
        difficulty: p.difficulty,
        category: p.category,
        acceptance_rate: p.acceptance_rate
      }));
    return { ...contest, problems: contestProblems };
  },

  async registerForContest(contestId, userId, username) {
    const contest = state.contests.find(c => c.id === contestId);
    if (!contest) throw new Error('Contest not found');
    contest.participants_count = (contest.participants_count || 0) + 1;
    return { success: true, message: `Successfully registered for ${contest.title}!` };
  },

  async getContestLeaderboard(contestId) {
    const participants = state.contestParticipants[contestId] || {};
    const list = Object.values(participants);
    list.sort((a, b) => b.score - a.score || a.submissions_count - b.submissions_count);
    return list.map((item, idx) => ({ rank: idx + 1, ...item }));
  },

  // 8. Global Leaderboard
  async getLeaderboard({ filter = 'global' }) {
    // Sort by rating descending
    const sorted = [...state.leaderboard].sort((a, b) => b.rating - a.rating);
    return sorted.map((entry, idx) => ({
      rank: idx + 1,
      ...entry
    }));
  },

  // 9. User profile & coding analytics
  async getUserProfile(userId, username) {
    const stats = getUserStats(userId, username);
    const submissions = state.submissions.filter(s => s.user_id == userId);

    // Language usage distribution
    const langUsage = {};
    submissions.forEach(s => {
      langUsage[s.language] = (langUsage[s.language] || 0) + 1;
    });

    // Topic distribution
    const topicDistribution = {};
    const solvedSet = new Set(stats.solved_problem_ids || []);
    state.problems.forEach(p => {
      if (solvedSet.has(p.id)) {
        topicDistribution[p.category] = (topicDistribution[p.category] || 0) + 1;
      }
    });

    return {
      profile: {
        user_id: stats.user_id,
        username: stats.username,
        rating: stats.rating,
        global_rank: stats.global_rank,
        current_streak: stats.current_streak,
        longest_streak: stats.longest_streak,
        badges: stats.badges,
        total_solved: stats.total_solved,
        easy_solved: stats.easy_solved,
        medium_solved: stats.medium_solved,
        hard_solved: stats.hard_solved,
        total_submissions: stats.total_submissions,
        accepted_submissions: stats.accepted_submissions,
        acceptance_rate: stats.acceptance_rate
      },
      analytics: {
        language_usage: langUsage,
        topic_distribution: topicDistribution,
        activity_calendar: [
          { date: '2026-11-01', count: 4 },
          { date: '2026-11-02', count: 6 },
          { date: '2026-11-03', count: 3 },
          { date: '2026-11-04', count: 5 }
        ]
      }
    };
  },

  // 10. Editorial & Discussions
  async getEditorial(problemId, isContest) {
    if (isContest) {
      throw new Error('Official editorial is locked until the contest concludes.');
    }
    const problem = state.problems.find(p => p.id === problemId);
    if (!problem || !problem.editorial) throw new Error('Editorial not found');
    return problem.editorial;
  },

  async getDiscussions(problemId) {
    return state.discussions.filter(d => d.problem_id === problemId);
  },

  async createDiscussion({ problemId, userId, userName, title, content, tags }) {
    const newDisc = {
      id: `disc-${Date.now()}`,
      problem_id: problemId,
      user_id: userId,
      user_name: userName,
      title,
      content,
      upvotes: 0,
      tags: tags || [],
      created_at: new Date().toISOString(),
      comments: []
    };
    state.discussions.unshift(newDisc);
    return newDisc;
  },

  async addComment({ discussionId, userId, userName, content }) {
    const disc = state.discussions.find(d => d.id === discussionId);
    if (!disc) throw new Error('Discussion not found');
    const comment = {
      id: `comm-${Date.now()}`,
      user_id: userId,
      user_name: userName,
      content,
      created_at: new Date().toISOString()
    };
    disc.comments.push(comment);
    return comment;
  },

  async upvoteDiscussion(discussionId) {
    const disc = state.discussions.find(d => d.id === discussionId);
    if (disc) disc.upvotes++;
    return disc;
  },

  // 11. Admin Management
  async adminCreateProblem(problemData) {
    const newProblem = {
      id: problemData.id || problemData.slug || `prob-${Date.now()}`,
      slug: problemData.slug || problemData.title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      ...problemData,
      total_submissions: 0,
      accepted_submissions: 0,
      acceptance_rate: 0,
      created_at: new Date().toISOString()
    };
    state.problems.push(newProblem);
    return newProblem;
  },

  async adminUpdateProblem(id, problemData) {
    const idx = state.problems.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Problem not found');
    state.problems[idx] = { ...state.problems[idx], ...problemData, updated_at: new Date().toISOString() };
    return state.problems[idx];
  },

  async adminDeleteProblem(id) {
    const idx = state.problems.findIndex(p => p.id === id);
    if (idx !== -1) state.problems.splice(idx, 1);
    return { success: true, message: 'Problem deleted' };
  },

  async adminCreateContest(contestData) {
    const newContest = {
      id: contestData.id || `contest-${Date.now()}`,
      ...contestData,
      participants_count: 0,
      created_at: new Date().toISOString()
    };
    state.contests.push(newContest);
    return newContest;
  }
};

module.exports = codeArenaService;
