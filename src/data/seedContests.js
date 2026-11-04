// Seed Contests Data for CodeArena

const now = Date.now();
const oneHour = 60 * 60 * 1000;
const oneDay = 24 * oneHour;

const seedContests = [
  {
    id: 'weekly-clash-42',
    title: 'DevForge Weekly Clash #42',
    description: 'Weekly algorithmic battle designed for all skill levels from beginner to grandmaster.',
    status: 'live',
    start_time: new Date(now - 30 * 60 * 1000).toISOString(), // started 30 mins ago
    end_time: new Date(now + 90 * 60 * 1000).toISOString(),   // ends in 90 mins
    duration_minutes: 120,
    problem_ids: ['two-sum', 'valid-parentheses', 'maximum-subarray', 'coin-change'],
    participants_count: 142,
    rules: 'Standard ICPC style scoring: 100 points per problem solved. 10 penalty points per failed submission. AI code solutions are strictly disabled during live contests.'
  },
  {
    id: 'spring-open-2026',
    title: 'Algorithm Masters Spring Open 2026',
    description: 'Premier seasonal contest featuring novel dynamic programming and graph theory challenges.',
    status: 'upcoming',
    start_time: new Date(now + 2 * oneDay).toISOString(),
    end_time: new Date(now + 2 * oneDay + 3 * oneHour).toISOString(),
    duration_minutes: 180,
    problem_ids: ['longest-substring-without-repeating-characters', 'number-of-islands', 'trapping-rain-water'],
    participants_count: 389,
    rules: 'Rating changes applied to all registered users. Unrated for contestants with < 3 rated contests.'
  },
  {
    id: 'grand-prix-1',
    title: 'DevForge Grand Prix Invitational #1',
    description: 'Inaugural high-stakes championship with time-pressured hard challenge problems.',
    status: 'completed',
    start_time: new Date(now - 7 * oneDay).toISOString(),
    end_time: new Date(now - 7 * oneDay + 2 * oneHour).toISOString(),
    duration_minutes: 120,
    problem_ids: ['reverse-linked-list', 'palindrome-number', 'trapping-rain-water'],
    participants_count: 856,
    rules: 'Finalized rankings and official editorials are published.'
  }
];

const seedLeaderboard = [
  { rank: 1, user_id: 101, username: 'neocortex_dev', rating: 2480, solved: 14, score: 1420, country: 'IN', streak: 45, badges: ['Grandmaster', 'Streak 30'] },
  { rank: 2, user_id: 102, username: 'algo_sorcerer', rating: 2340, solved: 13, score: 1310, country: 'US', streak: 28, badges: ['Master', 'DP Ace'] },
  { rank: 3, user_id: 103, username: 'binary_blaze', rating: 2210, solved: 12, score: 1205, country: 'DE', streak: 19, badges: ['Candidate Master'] },
  { rank: 4, user_id: 1, username: 'Demo Architect', rating: 1850, solved: 6, score: 620, country: 'US', streak: 7, badges: ['Specialist', 'First Solve'] },
  { rank: 5, user_id: 104, username: 'code_samurai', rating: 1780, solved: 7, score: 710, country: 'JP', streak: 12, badges: ['Specialist'] },
  { rank: 6, user_id: 105, username: 'zero_day_ninja', rating: 1690, solved: 6, score: 590, country: 'SG', streak: 8, badges: ['Expert'] },
  { rank: 7, user_id: 106, username: 'quantum_coder', rating: 1540, solved: 5, score: 480, country: 'CA', streak: 14, badges: ['Pupil'] },
  { rank: 8, user_id: 107, username: 'cyber_phoenix', rating: 1410, solved: 4, score: 390, country: 'GB', streak: 5, badges: ['Newbie'] }
];

module.exports = { seedContests, seedLeaderboard };
