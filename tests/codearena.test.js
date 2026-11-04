const test = require('node:test');
const assert = require('node:assert');
const codeArenaService = require('../src/services/codeArenaService');
const { executeCode } = require('../src/services/judge0Service');
const codeArenaAiService = require('../src/services/codeArenaAiService');

test('CodeArena Problem Management & Filtering Test', async () => {
  const allProbs = await codeArenaService.getProblems({ page: 1, limit: 10 });
  assert.ok(allProbs.problems.length > 0, 'Should return seed problems');

  const easyProbs = await codeArenaService.getProblems({ difficulty: 'Easy' });
  assert.ok(easyProbs.problems.every(p => p.difficulty === 'Easy'), 'All problems should have Easy difficulty');

  const twoSum = await codeArenaService.getProblemById('two-sum', 1);
  assert.strictEqual(twoSum.title, 'Two Sum');
  assert.ok(twoSum.sample_test_cases.length > 0, 'Should have sample test cases');
  assert.strictEqual(twoSum.hidden_test_cases, undefined, 'Hidden test cases must NEVER be exposed to frontend');
});

test('CodeArena Sandboxed Code Execution Test', async () => {
  const jsCode = `
const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim();
console.log(input.toUpperCase());
`;
  const result = await executeCode({
    code: jsCode,
    language: 'javascript',
    stdin: 'hello devforge'
  });

  assert.strictEqual(result.status, 'Accepted');
  assert.strictEqual(result.stdout, 'HELLO DEVFORGE');
});

test('CodeArena Submit Two Sum Solution Test', async () => {
  const problem = await codeArenaService.getProblemById('two-sum', 1);
  const starterJs = `
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const comp = target - nums[i];
    if (map.has(comp)) return [map.get(comp), i];
    map.set(nums[i], i);
  }
  return [];
}
const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
if (input.length >= 3) {
  const n = parseInt(input[0]);
  const nums = input.slice(1, 1 + n).map(Number);
  const target = parseInt(input[1 + n]);
  const ans = twoSum(nums, target);
  console.log(ans.join(' '));
}
`;

  const sub = await codeArenaService.submitCode({
    problemId: 'two-sum',
    code: starterJs,
    language: 'javascript',
    userId: 1,
    username: 'Demo Architect'
  });

  assert.strictEqual(sub.status, 'Accepted', 'Two Sum submission should be Accepted');
  assert.strictEqual(sub.passed_test_cases, sub.total_test_cases, 'All test cases must pass');

  const dashboard = await codeArenaService.getDashboard(1, 'Demo Architect');
  assert.ok(dashboard.stats.total_solved >= 1, 'Solved count should be at least 1');
});

test('CodeArena Contests & Leaderboard Test', async () => {
  const contests = await codeArenaService.getContests();
  assert.ok(contests.length >= 3, 'Should have live, upcoming, and completed contests');

  const reg = await codeArenaService.registerForContest('weekly-clash-42', 1, 'Demo Architect');
  assert.strictEqual(reg.success, true);

  const leaderboard = await codeArenaService.getLeaderboard({ filter: 'global' });
  assert.ok(leaderboard.length > 0, 'Leaderboard should have ranked users');
  assert.strictEqual(leaderboard[0].rank, 1, 'First user should be rank 1');
});

test('CodeArena AI Assistant Test', async () => {
  const problem = await codeArenaService.getProblemById('two-sum', 1);

  const hint = await codeArenaAiService.getHint({ problem, level: 1 });
  assert.ok(hint.hint.length > 0, 'Hint should be provided');

  const complexity = await codeArenaAiService.analyzeComplexity({
    problem,
    code: 'function twoSum() {}',
    language: 'javascript'
  });
  assert.ok(complexity.complexity.length > 0, 'Complexity analysis should be generated');
});
