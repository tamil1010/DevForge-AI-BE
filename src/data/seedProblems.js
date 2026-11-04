// Comprehensive Seed Data for CodeArena - 15 Competitive Programming Problems across 12 Categories

const seedProblems = [
  {
    id: 'two-sum',
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    category: 'Arrays',
    acceptance_rate: 49.2,
    total_submissions: 15420,
    accepted_submissions: 7586,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.`,
    input_format: 'First line contains integer n (array length). Second line contains n space-separated integers. Third line contains the target integer.',
    output_format: 'Print two space-separated indices (0-indexed).',
    constraints: `2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.`,
    supported_languages: ['javascript', 'python', 'cpp', 'java', 'c'],
    starter_templates: {
      javascript: `// Two Sum
// Return indices [i, j]
function twoSum(nums, target) {
  // Write your code here
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
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
`,
      python: `import sys

def two_sum(nums, target):
    # Write your solution here
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []

if __name__ == '__main__':
    data = sys.stdin.read().split()
    if len(data) >= 3:
        n = int(data[0])
        nums = [int(x) for x in data[1:1+n]]
        target = int(data[1+n])
        ans = two_sum(nums, target)
        print(f"{ans[0]} {ans[1]}")
`,
      cpp: `#include <iostream>
#include <vector>
#include <unordered_map>

using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> mp;
    for (int i = 0; i < nums.size(); ++i) {
        int comp = target - nums[i];
        if (mp.count(comp)) {
            return {mp[comp], i};
        }
        mp[nums[i]] = i;
    }
    return {};
}

int main() {
    int n;
    if (cin >> n) {
        vector<int> nums(n);
        for (int i = 0; i < n; ++i) cin >> nums[i];
        int target;
        cin >> target;
        vector<int> res = twoSum(nums, target);
        if (res.size() == 2) cout << res[0] << " " << res[1] << endl;
    }
    return 0;
}
`,
      java: `import java.util.*;

public class Main {
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int comp = target - nums[i];
            if (map.containsKey(comp)) {
                return new int[] { map.get(comp), i };
            }
            map.put(nums[i], i);
        }
        return new int[]{};
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int n = sc.nextInt();
            int[] nums = new int[n];
            for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
            int target = sc.nextInt();
            int[] res = twoSum(nums, target);
            if (res.length == 2) System.out.println(res[0] + " " + res[1]);
        }
    }
}
`,
      c: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1) return 0;
    int nums[n];
    for (int i = 0; i < n; i++) scanf("%d", &nums[i]);
    int target;
    scanf("%d", &target);
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            if (nums[i] + nums[j] == target) {
                printf("%d %d\\n", i, j);
                return 0;
            }
        }
    }
    return 0;
}
`
    },
    sample_test_cases: [
      {
        input: '4\n2 7 11 15\n9',
        expected_output: '0 1',
        explanation: 'Because nums[0] + nums[1] == 9, we return 0 1.'
      },
      {
        input: '3\n3 2 4\n6',
        expected_output: '1 2',
        explanation: 'Because nums[1] + nums[2] == 6, we return 1 2.'
      }
    ],
    hidden_test_cases: [
      {
        input: '2\n3 3\n6',
        expected_output: '0 1'
      },
      {
        input: '5\n1 5 3 7 9\n12',
        expected_output: '1 3'
      },
      {
        input: '6\n-3 4 3 90 2 1\n0',
        expected_output: '0 2'
      }
    ],
    hints: [
      'A brute force approach scans every pair with two nested loops in O(n^2) time. Can you do it faster using extra memory?',
      'Can you use a hash map to check whether target - nums[i] has already been seen in O(1) average time?',
      'Iterate through nums once: for each index i, check if (target - nums[i]) is in the map. If yes, return [map.get(target - nums[i]), i]. Otherwise, put nums[i] -> i in map.'
    ],
    editorial: {
      approach: 'Hash Map Lookup (One-Pass)',
      algorithm: 'While we iterate and inserting elements into the table, we also look back to check if current element\'s complement already exists in the table. If it exists, we found the solution and return its index immediately.',
      time_complexity: 'O(n) - We traverse the list containing n elements only once. Each lookup in the hash table takes O(1) time.',
      space_complexity: 'O(n) - The extra space required depends on the number of items stored in the hash table, which stores at most n elements.',
      solution_code: `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const comp = target - nums[i];
    if (map.has(comp)) return [map.get(comp), i];
    map.set(nums[i], i);
  }
  return [];
}`
    }
  },
  {
    id: 'valid-parentheses',
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    category: 'Stack and Queue',
    acceptance_rate: 40.5,
    total_submissions: 22000,
    accepted_submissions: 8910,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    input_format: 'A single line containing the string s.',
    output_format: 'Print "true" if the string is valid, or "false" otherwise.',
    constraints: `1 <= s.length <= 10^4\ns consists of parentheses only '()[]{}'.`,
    supported_languages: ['javascript', 'python', 'cpp', 'java', 'c'],
    starter_templates: {
      javascript: `function isValid(s) {
  const stack = [];
  const map = { ')': '(', '}': '{', ']': '[' };
  for (const ch of s) {
    if (ch === '(' || ch === '{' || ch === '[') {
      stack.push(ch);
    } else {
      if (stack.pop() !== map[ch]) return false;
    }
  }
  return stack.length === 0;
}

const fs = require('fs');
const s = fs.readFileSync(0, 'utf-8').trim();
console.log(isValid(s) ? 'true' : 'false');
`,
      python: `import sys

def is_valid(s: str) -> bool:
    stack = []
    mapping = {')': '(', '}': '{', ']': '['}
    for char in s:
        if char in mapping:
            top = stack.pop() if stack else '#'
            if mapping[char] != top:
                return False
        else:
            stack.append(char)
    return not stack

if __name__ == '__main__':
    s = sys.stdin.read().strip()
    print("true" if is_valid(s) else "false")
`,
      cpp: `#include <iostream>
#include <string>
#include <stack>

using namespace std;

bool isValid(string s) {
    stack<char> st;
    for (char c : s) {
        if (c == '(' || c == '{' || c == '[') st.push(c);
        else {
            if (st.empty()) return false;
            char top = st.top();
            st.pop();
            if (c == ')' && top != '(') return false;
            if (c == '}' && top != '{') return false;
            if (c == ']' && top != '[') return false;
        }
    }
    return st.empty();
}

int main() {
    string s;
    if (cin >> s) {
        cout << (isValid(s) ? "true" : "false") << endl;
    }
    return 0;
}
`,
      java: `import java.util.*;

public class Main {
    public static boolean isValid(String s) {
        Stack<Character> stack = new Stack<>();
        for (char c : s.toCharArray()) {
            if (c == '(') stack.push(')');
            else if (c == '{') stack.push('}');
            else if (c == '[') stack.push(']');
            else if (stack.isEmpty() || stack.pop() != c) return false;
        }
        return stack.isEmpty();
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNext()) {
            String s = sc.next();
            System.out.println(isValid(s) ? "true" : "false");
        }
    }
}
`,
      c: `#include <stdio.h>
#include <string.h>
#include <stdbool.h>

bool isValid(char *s) {
    int len = strlen(s);
    char stack[len + 1];
    int top = -1;
    for (int i = 0; i < len; i++) {
        char c = s[i];
        if (c == '(' || c == '{' || c == '[') {
            stack[++top] = c;
        } else {
            if (top == -1) return false;
            char t = stack[top--];
            if (c == ')' && t != '(') return false;
            if (c == '}' && t != '{') return false;
            if (c == ']' && t != '[') return false;
        }
    }
    return top == -1;
}

int main() {
    char s[10005];
    if (scanf("%s", s) == 1) {
        printf("%s\\n", isValid(s) ? "true" : "false");
    }
    return 0;
}
`
    },
    sample_test_cases: [
      {
        input: '()[]{}',
        expected_output: 'true',
        explanation: 'All parentheses match correctly.'
      },
      {
        input: '(]',
        expected_output: 'false',
        explanation: 'Open parenthesis does not match square bracket.'
      }
    ],
    hidden_test_cases: [
      {
        input: '([)]',
        expected_output: 'false'
      },
      {
        input: '{[]}',
        expected_output: 'true'
      },
      {
        input: '(((((((((())))))))))',
        expected_output: 'true'
      }
    ],
    hints: [
      'A stack is the ideal data structure here because parentheses must be closed in reverse order of opening (Last-In-First-Out).',
      'Whenever you encounter an opening bracket, push it to stack. When you encounter a closing bracket, check whether the top of stack matches.',
      'Remember to check if the stack is completely empty at the end.'
    ],
    editorial: {
      approach: 'Stack Data Structure',
      algorithm: 'Push opening brackets to stack. For closing brackets, pop and verify type match. String is valid iff stack is empty at end.',
      time_complexity: 'O(n) - Single pass over the string.',
      space_complexity: 'O(n) - In worst case (e.g. all opening brackets), stack stores all characters.',
      solution_code: `function isValid(s) {
  const stack = [];
  const map = { ')': '(', '}': '{', ']': '[' };
  for (const c of s) {
    if (!map[c]) stack.push(c);
    else if (stack.pop() !== map[c]) return false;
  }
  return stack.length === 0;
}`
    }
  },
  {
    id: 'maximum-subarray',
    slug: 'maximum-subarray',
    title: 'Maximum Subarray (Kadane\'s Algorithm)',
    difficulty: 'Medium',
    category: 'Dynamic Programming',
    acceptance_rate: 50.1,
    total_submissions: 18900,
    accepted_submissions: 9469,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    description: `Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.

A subarray is a contiguous non-empty sequence of elements within an array.`,
    input_format: 'First line contains integer n. Second line contains n space-separated integers.',
    output_format: 'Print the maximum subarray sum.',
    constraints: `1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4`,
    supported_languages: ['javascript', 'python', 'cpp', 'java', 'c'],
    starter_templates: {
      javascript: `function maxSubArray(nums) {
  let currentSum = nums[0];
  let maxSum = nums[0];
  for (let i = 1; i < nums.length; i++) {
    currentSum = Math.max(nums[i], currentSum + nums[i]);
    maxSum = Math.max(maxSum, currentSum);
  }
  return maxSum;
}

const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
if (input.length > 0) {
  const n = parseInt(input[0]);
  const nums = input.slice(1, 1 + n).map(Number);
  console.log(maxSubArray(nums));
}
`,
      python: `import sys

def max_sub_array(nums):
    current_sum = nums[0]
    max_sum = nums[0]
    for num in nums[1:]:
        current_sum = max(num, current_sum + num)
        max_sum = max(max_sum, current_sum)
    return max_sum

if __name__ == '__main__':
    data = sys.stdin.read().split()
    if data:
        n = int(data[0])
        nums = [int(x) for x in data[1:1+n]]
        print(max_sub_array(nums))
`,
      cpp: `#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

int maxSubArray(vector<int>& nums) {
    int cur = nums[0], mx = nums[0];
    for (size_t i = 1; i < nums.size(); ++i) {
        cur = max(nums[i], cur + nums[i]);
        mx = max(mx, cur);
    }
    return mx;
}

int main() {
    int n;
    if (cin >> n) {
        vector<int> nums(n);
        for (int i = 0; i < n; ++i) cin >> nums[i];
        cout << maxSubArray(nums) << endl;
    }
    return 0;
}
`,
      java: `import java.util.*;

public class Main {
    public static int maxSubArray(int[] nums) {
        int current = nums[0], max = nums[0];
        for (int i = 1; i < nums.length; i++) {
            current = Math.max(nums[i], current + nums[i]);
            max = Math.max(max, current);
        }
        return max;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int n = sc.nextInt();
            int[] nums = new int[n];
            for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
            System.out.println(maxSubArray(nums));
        }
    }
}
`,
      c: `#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1) return 0;
    long long nums[n];
    for (int i = 0; i < n; i++) scanf("%lld", &nums[i]);
    long long cur = nums[0], max = nums[0];
    for (int i = 1; i < n; i++) {
        cur = (nums[i] > cur + nums[i]) ? nums[i] : (cur + nums[i]);
        if (cur > max) max = cur;
    }
    printf("%lld\\n", max);
    return 0;
}
`
    },
    sample_test_cases: [
      {
        input: '9\n-2 1 -3 4 -1 2 1 -5 4',
        expected_output: '6',
        explanation: 'The subarray [4,-1,2,1] has the largest sum 6.'
      },
      {
        input: '1\n1',
        expected_output: '1',
        explanation: 'Subarray [1] has the largest sum 1.'
      }
    ],
    hidden_test_cases: [
      {
        input: '5\n5 4 -1 7 8',
        expected_output: '23'
      },
      {
        input: '3\n-5 -2 -3',
        expected_output: '-2'
      }
    ],
    hints: [
      'If current subarray sum becomes negative, would adding it to the next element ever help? No, it only drags it down!',
      'Kadane\'s algorithm maintains current_sum = max(nums[i], current_sum + nums[i]).'
    ],
    editorial: {
      approach: 'Kadane\'s Algorithm (Dynamic Programming)',
      algorithm: 'At each position, we decide whether to extend the previous subarray or start a fresh subarray at the current element.',
      time_complexity: 'O(n) - Single linear pass.',
      space_complexity: 'O(1) - Constant auxiliary storage.',
      solution_code: `function maxSubArray(nums) {
  let cur = nums[0], ans = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    ans = Math.max(ans, cur);
  }
  return ans;
}`
    }
  },
  {
    id: 'longest-substring-without-repeating-characters',
    slug: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    category: 'Strings',
    acceptance_rate: 34.8,
    total_submissions: 16400,
    accepted_submissions: 5707,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    description: `Given a string \`s\`, find the length of the **longest substring** without duplicate characters.`,
    input_format: 'A single line containing the string s.',
    output_format: 'Print an integer denoting the length of the longest substring.',
    constraints: `0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.`,
    supported_languages: ['javascript', 'python', 'cpp', 'java', 'c'],
    starter_templates: {
      javascript: `function lengthOfLongestSubstring(s) {
  const map = new Map();
  let maxLen = 0, left = 0;
  for (let right = 0; right < s.length; right++) {
    if (map.has(s[right])) {
      left = Math.max(left, map.get(s[right]) + 1);
    }
    map.set(s[right], right);
    maxLen = Math.max(maxLen, right - left + 1);
  }
  return maxLen;
}

const fs = require('fs');
const s = fs.readFileSync(0, 'utf-8').replace(/[\\r\\n]/g, '');
console.log(lengthOfLongestSubstring(s));
`,
      python: `import sys

def length_of_longest_substring(s: str) -> int:
    char_index = {}
    left = 0
    max_len = 0
    for right, char in enumerate(s):
        if char in char_index and char_index[char] >= left:
            left = char_index[char] + 1
        char_index[char] = right
        max_len = max(max_len, right - left + 1)
    return max_len

if __name__ == '__main__':
    s = sys.stdin.read().rstrip('\\r\\n')
    print(length_of_longest_substring(s))
`,
      cpp: `#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

using namespace std;

int lengthOfLongestSubstring(string s) {
    vector<int> last(256, -1);
    int max_len = 0, left = 0;
    for (int right = 0; right < s.length(); ++right) {
        if (last[(unsigned char)s[right]] >= left) {
            left = last[(unsigned char)s[right]] + 1;
        }
        last[(unsigned char)s[right]] = right;
        max_len = max(max_len, right - left + 1);
    }
    return max_len;
}

int main() {
    string s;
    getline(cin, s);
    cout << lengthOfLongestSubstring(s) << endl;
    return 0;
}
`,
      java: `import java.util.*;

public class Main {
    public static int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> map = new HashMap<>();
        int maxLen = 0, left = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            if (map.containsKey(c) && map.get(c) >= left) {
                left = map.get(c) + 1;
            }
            map.put(c, right);
            maxLen = Math.max(maxLen, right - left + 1);
        }
        return maxLen;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        System.out.println(lengthOfLongestSubstring(s));
    }
}
`,
      c: `#include <stdio.h>
#include <string.h>

int main() {
    char s[50005];
    if (!fgets(s, sizeof(s), stdin)) {
        printf("0\\n");
        return 0;
    }
    int len = strlen(s);
    if (len > 0 && (s[len - 1] == '\\n' || s[len - 1] == '\\r')) s[--len] = '\\0';
    int last[256];
    for (int i = 0; i < 256; i++) last[i] = -1;
    int maxLen = 0, left = 0;
    for (int right = 0; right < len; right++) {
        unsigned char c = (unsigned char)s[right];
        if (last[c] >= left) left = last[c] + 1;
        last[c] = right;
        int cur = right - left + 1;
        if (cur > maxLen) maxLen = cur;
    }
    printf("%d\\n", maxLen);
    return 0;
}
`
    },
    sample_test_cases: [
      {
        input: 'abcabcbb',
        expected_output: '3',
        explanation: 'The answer is "abc", with the length of 3.'
      },
      {
        input: 'bbbbb',
        expected_output: '1',
        explanation: 'The answer is "b", with the length of 1.'
      }
    ],
    hidden_test_cases: [
      {
        input: 'pwwkew',
        expected_output: '3'
      },
      {
        input: 'abcdefghijklmnopqrstuvwxyz',
        expected_output: '26'
      }
    ],
    hints: [
      'Use a sliding window [left, right]. As right expands, record the character index.',
      'When you see a repeated character, advance left to index + 1.'
    ],
    editorial: {
      approach: 'Sliding Window with Hash Map',
      algorithm: 'We track indices of characters. When a duplicate is met within the window, move left pointer directly beyond the duplicate.',
      time_complexity: 'O(n) - Both left and right pointers traverse at most n steps.',
      space_complexity: 'O(min(m, n)) - Set stores at most alphabet size m or string size n.',
      solution_code: `function lengthOfLongestSubstring(s) {
  const map = new Map();
  let maxLen = 0, left = 0;
  for (let right = 0; right < s.length; right++) {
    if (map.has(s[right]) && map.get(s[right]) >= left) {
      left = map.get(s[right]) + 1;
    }
    map.set(s[right], right);
    maxLen = Math.max(maxLen, right - left + 1);
  }
  return maxLen;
}`
    }
  },
  {
    id: 'reverse-linked-list',
    slug: 'reverse-linked-list',
    title: 'Reverse Linked List',
    difficulty: 'Easy',
    category: 'Linked Lists',
    acceptance_rate: 73.4,
    total_submissions: 31000,
    accepted_submissions: 22754,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    description: `Given the \`head\` of a singly linked list, reverse the list, and return the reversed list.`,
    input_format: 'First line contains integer n (number of nodes). Second line contains n space-separated node values.',
    output_format: 'Print the reversed list node values space-separated.',
    constraints: `0 <= Number of nodes <= 5000\n-5000 <= Node.val <= 5000`,
    supported_languages: ['javascript', 'python', 'cpp', 'java', 'c'],
    starter_templates: {
      javascript: `const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
if (input.length > 0 && input[0] !== '') {
  const n = parseInt(input[0]);
  const vals = input.slice(1, 1 + n);
  vals.reverse();
  console.log(vals.join(' '));
}
`,
      python: `import sys

data = sys.stdin.read().split()
if data:
    n = int(data[0])
    vals = data[1:1+n]
    vals.reverse()
    print(" ".join(vals))
`,
      cpp: `#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

int main() {
    int n;
    if (cin >> n) {
        vector<int> vals(n);
        for (int i = 0; i < n; i++) cin >> vals[i];
        for (int i = n - 1; i >= 0; i--) {
            cout << vals[i] << (i == 0 ? "" : " ");
        }
        cout << endl;
    }
    return 0;
}
`,
      java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int n = sc.nextInt();
            int[] vals = new int[n];
            for (int i = 0; i < n; i++) vals[i] = sc.nextInt();
            for (int i = n - 1; i >= 0; i--) {
                System.out.print(vals[i] + (i == 0 ? "" : " "));
            }
            System.out.println();
        }
    }
}
`,
      c: `#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1) return 0;
    int a[n];
    for (int i = 0; i < n; i++) scanf("%d", &a[i]);
    for (int i = n - 1; i >= 0; i--) {
        printf("%d%s", a[i], i == 0 ? "" : " ");
    }
    printf("\\n");
    return 0;
}
`
    },
    sample_test_cases: [
      {
        input: '5\n1 2 3 4 5',
        expected_output: '5 4 3 2 1',
        explanation: 'Reversing 1->2->3->4->5 yields 5->4->3->2->1.'
      },
      {
        input: '2\n1 2',
        expected_output: '2 1',
        explanation: 'Reversing 1->2 yields 2->1.'
      }
    ],
    hidden_test_cases: [
      {
        input: '1\n99',
        expected_output: '99'
      },
      {
        input: '6\n10 20 30 40 50 60',
        expected_output: '60 50 40 30 20 10'
      }
    ],
    hints: [
      'Iterative approach maintains three pointers: prev, curr, and next.',
      'In each step: next = curr.next; curr.next = prev; prev = curr; curr = next;'
    ],
    editorial: {
      approach: 'Iterative Three-Pointer Reversal',
      algorithm: 'Iterate through linked list, re-pointing curr.next to prev.',
      time_complexity: 'O(n) - Traverses list once.',
      space_complexity: 'O(1) - In-place pointer manipulation.',
      solution_code: `function reverseList(head) {
  let prev = null, curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}`
    }
  },
  {
    id: 'coin-change',
    slug: 'coin-change',
    title: 'Coin Change',
    difficulty: 'Medium',
    category: 'Dynamic Programming',
    acceptance_rate: 42.1,
    total_submissions: 14200,
    accepted_submissions: 5978,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    description: `You are given an integer array \`coins\` representing coins of different denominations and an integer \`amount\` representing a total amount of money.

Return the **fewest number of coins** that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return \`-1\`.

You may assume that you have an infinite number of each kind of coin.`,
    input_format: 'First line contains integer n (number of coin types). Second line contains n space-separated integers. Third line contains the target amount.',
    output_format: 'Print the minimum number of coins, or -1.',
    constraints: `1 <= coins.length <= 12\n1 <= coins[i] <= 2^31 - 1\n0 <= amount <= 10^4`,
    supported_languages: ['javascript', 'python', 'cpp', 'java', 'c'],
    starter_templates: {
      javascript: `function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let i = 1; i <= amount; i++) {
    for (const coin of coins) {
      if (i - coin >= 0) {
        dp[i] = Math.min(dp[i], dp[i - coin] + 1);
      }
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}

const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
if (input.length >= 3) {
  const n = parseInt(input[0]);
  const coins = input.slice(1, 1 + n).map(Number);
  const amount = parseInt(input[1 + n]);
  console.log(coinChange(coins, amount));
}
`,
      python: `import sys

def coin_change(coins, amount):
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0
    for i in range(1, amount + 1):
        for c in coins:
            if i - c >= 0:
                dp[i] = min(dp[i], dp[i - c] + 1)
    return dp[amount] if dp[amount] != float('inf') else -1

if __name__ == '__main__':
    data = sys.stdin.read().split()
    if len(data) >= 3:
        n = int(data[0])
        coins = [int(x) for x in data[1:1+n]]
        amount = int(data[1+n])
        print(coin_change(coins, amount))
`,
      cpp: `#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

int coinChange(vector<int>& coins, int amount) {
    vector<int> dp(amount + 1, amount + 1);
    dp[0] = 0;
    for (int i = 1; i <= amount; i++) {
        for (int c : coins) {
            if (i - c >= 0) dp[i] = min(dp[i], dp[i - c] + 1);
        }
    }
    return dp[amount] > amount ? -1 : dp[amount];
}

int main() {
    int n;
    if (cin >> n) {
        vector<int> coins(n);
        for (int i = 0; i < n; i++) cin >> coins[i];
        int amount;
        cin >> amount;
        cout << coinChange(coins, amount) << endl;
    }
    return 0;
}
`,
      java: `import java.util.*;

public class Main {
    public static int coinChange(int[] coins, int amount) {
        int[] dp = new int[amount + 1];
        Arrays.fill(dp, amount + 1);
        dp[0] = 0;
        for (int i = 1; i <= amount; i++) {
            for (int c : coins) {
                if (i - c >= 0) dp[i] = Math.min(dp[i], dp[i - c] + 1);
            }
        }
        return dp[amount] > amount ? -1 : dp[amount];
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int n = sc.nextInt();
            int[] coins = new int[n];
            for (int i = 0; i < n; i++) coins[i] = sc.nextInt();
            int amount = sc.nextInt();
            System.out.println(coinChange(coins, amount));
        }
    }
}
`,
      c: `#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1) return 0;
    int coins[n];
    for (int i = 0; i < n; i++) scanf("%d", &coins[i]);
    int amount;
    scanf("%d", &amount);
    int dp[amount + 1];
    dp[0] = 0;
    for (int i = 1; i <= amount; i++) dp[i] = 1000000;
    for (int i = 1; i <= amount; i++) {
        for (int j = 0; j < n; j++) {
            if (i - coins[j] >= 0 && dp[i - coins[j]] + 1 < dp[i]) {
                dp[i] = dp[i - coins[j]] + 1;
            }
        }
    }
    printf("%d\\n", dp[amount] >= 1000000 ? -1 : dp[amount]);
    return 0;
}
`
    },
    sample_test_cases: [
      {
        input: '3\n1 2 5\n11',
        expected_output: '3',
        explanation: '11 = 5 + 5 + 1 (3 coins total).'
      },
      {
        input: '1\n2\n3',
        expected_output: '-1',
        explanation: 'Amount 3 cannot be formed using only coins of value 2.'
      }
    ],
    hidden_test_cases: [
      {
        input: '1\n1\n0',
        expected_output: '0'
      },
      {
        input: '4\n1 5 10 25\n63',
        expected_output: '6'
      }
    ],
    hints: [
      'Define dp[i] as the minimum coins needed to make amount i.',
      'Transition: dp[i] = min(dp[i], dp[i - coin] + 1) for each coin in coins.'
    ],
    editorial: {
      approach: 'Bottom-up Dynamic Programming',
      algorithm: 'We build up from amount 0 to target amount. dp[i] represents minimum coins needed for amount i.',
      time_complexity: 'O(S * n) - where S is the amount and n is number of coin denominations.',
      space_complexity: 'O(S) - Array of size amount + 1.',
      solution_code: `function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let i = 1; i <= amount; i++) {
    for (const c of coins) {
      if (i >= c) dp[i] = Math.min(dp[i], dp[i - c] + 1);
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}`
    }
  },
  {
    id: 'trapping-rain-water',
    slug: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
    category: 'Arrays',
    acceptance_rate: 59.8,
    total_submissions: 9200,
    accepted_submissions: 5501,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    description: `Given \`n\` non-negative integers representing an elevation map where the width of each bar is \`1\`, compute how much water it can trap after raining.`,
    input_format: 'First line contains integer n. Second line contains n space-separated heights.',
    output_format: 'Print total trapped rainwater units.',
    constraints: `n == height.length\n1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5`,
    supported_languages: ['javascript', 'python', 'cpp', 'java', 'c'],
    starter_templates: {
      javascript: `function trap(height) {
  let left = 0, right = height.length - 1;
  let leftMax = 0, rightMax = 0, total = 0;
  while (left < right) {
    if (height[left] < height[right]) {
      if (height[left] >= leftMax) leftMax = height[left];
      else total += leftMax - height[left];
      left++;
    } else {
      if (height[right] >= rightMax) rightMax = height[right];
      else total += rightMax - height[right];
      right--;
    }
  }
  return total;
}

const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
if (input.length > 0) {
  const n = parseInt(input[0]);
  const heights = input.slice(1, 1 + n).map(Number);
  console.log(trap(heights));
}
`,
      python: `import sys

def trap(height):
    left, right = 0, len(height) - 1
    left_max = right_max = total = 0
    while left < right:
        if height[left] < height[right]:
            if height[left] >= left_max:
                left_max = height[left]
            else:
                total += left_max - height[left]
            left += 1
        else:
            if height[right] >= right_max:
                right_max = height[right]
            else:
                total += right_max - height[right]
            right -= 1
    return total

if __name__ == '__main__':
    data = sys.stdin.read().split()
    if data:
        n = int(data[0])
        heights = [int(x) for x in data[1:1+n]]
        print(trap(heights))
`,
      cpp: `#include <iostream>
#include <vector>

using namespace std;

int trap(vector<int>& height) {
    int left = 0, right = height.size() - 1;
    int leftMax = 0, rightMax = 0, ans = 0;
    while (left < right) {
        if (height[left] < height[right]) {
            if (height[left] >= leftMax) leftMax = height[left];
            else ans += leftMax - height[left];
            left++;
        } else {
            if (height[right] >= rightMax) rightMax = height[right];
            else ans += rightMax - height[right];
            right--;
        }
    }
    return ans;
}

int main() {
    int n;
    if (cin >> n) {
        vector<int> h(n);
        for (int i = 0; i < n; i++) cin >> h[i];
        cout << trap(h) << endl;
    }
    return 0;
}
`,
      java: `import java.util.*;

public class Main {
    public static int trap(int[] height) {
        int left = 0, right = height.length - 1;
        int leftMax = 0, rightMax = 0, ans = 0;
        while (left < right) {
            if (height[left] < height[right]) {
                if (height[left] >= leftMax) leftMax = height[left];
                else ans += leftMax - height[left];
                left++;
            } else {
                if (height[right] >= rightMax) rightMax = height[right];
                else ans += rightMax - height[right];
                right--;
            }
        }
        return ans;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int n = sc.nextInt();
            int[] h = new int[n];
            for (int i = 0; i < n; i++) h[i] = sc.nextInt();
            System.out.println(trap(h));
        }
    }
}
`,
      c: `#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1) return 0;
    int h[n];
    for (int i = 0; i < n; i++) scanf("%d", &h[i]);
    int left = 0, right = n - 1;
    int leftMax = 0, rightMax = 0;
    long long ans = 0;
    while (left < right) {
        if (h[left] < h[right]) {
            if (h[left] >= leftMax) leftMax = h[left];
            else ans += leftMax - h[left];
            left++;
        } else {
            if (h[right] >= rightMax) rightMax = h[right];
            else ans += rightMax - h[right];
            right--;
        }
    }
    printf("%lld\\n", ans);
    return 0;
}
`
    },
    sample_test_cases: [
      {
        input: '12\n0 1 0 2 1 0 1 3 2 1 2 1',
        expected_output: '6',
        explanation: 'Water trapped is 6 units.'
      },
      {
        input: '6\n4 2 0 3 2 5',
        expected_output: '9',
        explanation: 'Water trapped is 9 units.'
      }
    ],
    hidden_test_cases: [
      {
        input: '3\n2 0 2',
        expected_output: '2'
      },
      {
        input: '5\n3 0 0 0 3',
        expected_output: '9'
      }
    ],
    hints: [
      'The water level at bar i is determined by min(max_left, max_right) - height[i].',
      'Two pointers moving inwards (left and right) allow solving this in O(1) space.'
    ],
    editorial: {
      approach: 'Two Pointers Optimization',
      algorithm: 'Maintain left_max and right_max while moving two pointers toward center.',
      time_complexity: 'O(n) - Single pass through heights array.',
      space_complexity: 'O(1) - Constant auxiliary space.',
      solution_code: `function trap(height) {
  let l = 0, r = height.length - 1, lMax = 0, rMax = 0, water = 0;
  while (l < r) {
    if (height[l] < height[r]) {
      if (height[l] >= lMax) lMax = height[l];
      else water += lMax - height[l];
      l++;
    } else {
      if (height[r] >= rMax) rMax = height[r];
      else water += rMax - height[r];
      r--;
    }
  }
  return water;
}`
    }
  },
  {
    id: 'palindrome-number',
    slug: 'palindrome-number',
    title: 'Palindrome Number',
    difficulty: 'Easy',
    category: 'Mathematics',
    acceptance_rate: 55.4,
    total_submissions: 28000,
    accepted_submissions: 15512,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    description: `Given an integer \`x\`, return \`true\` if \`x\` is a **palindrome**, and \`false\` otherwise.

An integer is a palindrome when it reads the same forward and backward. For example, 121 is a palindrome while 123 is not.`,
    input_format: 'A single integer x.',
    output_format: 'Print "true" or "false".',
    constraints: `-2^31 <= x <= 2^31 - 1`,
    supported_languages: ['javascript', 'python', 'cpp', 'java', 'c'],
    starter_templates: {
      javascript: `function isPalindrome(x) {
  if (x < 0 || (x % 10 === 0 && x !== 0)) return false;
  let rev = 0;
  while (x > rev) {
    rev = rev * 10 + (x % 10);
    x = Math.floor(x / 10);
  }
  return x === rev || x === Math.floor(rev / 10);
}

const fs = require('fs');
const x = parseInt(fs.readFileSync(0, 'utf-8').trim());
console.log(isPalindrome(x) ? 'true' : 'false');
`,
      python: `import sys

def is_palindrome(x: int) -> bool:
    if x < 0 or (x % 10 == 0 and x != 0):
        return False
    rev = 0
    while x > rev:
        rev = rev * 10 + (x % 10)
        x //= 10
    return x == rev or x == rev // 10

if __name__ == '__main__':
    val = sys.stdin.read().strip()
    if val:
        print("true" if is_palindrome(int(val)) else "false")
`,
      cpp: `#include <iostream>

using namespace std;

bool isPalindrome(int x) {
    if (x < 0 || (x % 10 == 0 && x != 0)) return false;
    int rev = 0;
    while (x > rev) {
        rev = rev * 10 + (x % 10);
        x /= 10;
    }
    return x == rev || x == rev / 10;
}

int main() {
    int x;
    if (cin >> x) {
        cout << (isPalindrome(x) ? "true" : "false") << endl;
    }
    return 0;
}
`,
      java: `import java.util.*;

public class Main {
    public static boolean isPalindrome(int x) {
        if (x < 0 || (x % 10 == 0 && x != 0)) return false;
        int rev = 0;
        while (x > rev) {
            rev = rev * 10 + (x % 10);
            x /= 10;
        }
        return x == rev || x == rev / 10;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            System.out.println(isPalindrome(sc.nextInt()) ? "true" : "false");
        }
    }
}
`,
      c: `#include <stdio.h>
#include <stdbool.h>

bool isPalindrome(int x) {
    if (x < 0 || (x % 10 == 0 && x != 0)) return false;
    int rev = 0;
    while (x > rev) {
        rev = rev * 10 + (x % 10);
        x /= 10;
    }
    return x == rev || x == rev / 10;
}

int main() {
    int x;
    if (scanf("%d", &x) == 1) {
        printf("%s\\n", isPalindrome(x) ? "true" : "false");
    }
    return 0;
}
`
    },
    sample_test_cases: [
      {
        input: '121',
        expected_output: 'true',
        explanation: '121 reads 121 from left to right and from right to left.'
      },
      {
        input: '-121',
        expected_output: 'false',
        explanation: 'From left to right it reads -121. From right to left it becomes 121-.'
      }
    ],
    hidden_test_cases: [
      {
        input: '10',
        expected_output: 'false'
      },
      {
        input: '12321',
        expected_output: 'true'
      }
    ],
    hints: [
      'Negative numbers are never palindromes because of the minus sign.',
      'Reverting the second half of the number avoids integer overflow.'
    ],
    editorial: {
      approach: 'Half Number Reversion',
      algorithm: 'Reverse only the second half of the digits and check against first half.',
      time_complexity: 'O(log10(n)) - Digits count.',
      space_complexity: 'O(1) - Constant storage.',
      solution_code: `function isPalindrome(x) {
  if (x < 0 || (x % 10 === 0 && x !== 0)) return false;
  let rev = 0;
  while (x > rev) {
    rev = rev * 10 + (x % 10);
    x = Math.floor(x / 10);
  }
  return x === rev || x === Math.floor(rev / 10);
}`
    }
  },
  {
    id: 'number-of-islands',
    slug: 'number-of-islands',
    title: 'Number of Islands',
    difficulty: 'Medium',
    category: 'Graphs',
    acceptance_rate: 57.1,
    total_submissions: 12000,
    accepted_submissions: 6852,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    description: `Given an \`m x n\` 2D binary grid \`grid\` which represents a map of \`'1'\`s (land) and \`'0'\`s (water), return the number of islands.

An **island** is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are all surrounded by water.`,
    input_format: 'First line contains integers m and n. Following m lines contain n space-separated or contiguous characters representing the grid.',
    output_format: 'Print an integer denoting the number of islands.',
    constraints: `m == grid.length\nn == grid[i].length\n1 <= m, n <= 300\ngrid[i][j] is '0' or '1'.`,
    supported_languages: ['javascript', 'python', 'cpp', 'java', 'c'],
    starter_templates: {
      javascript: `function numIslands(grid) {
  if (!grid || grid.length === 0) return 0;
  const m = grid.length, n = grid[0].length;
  let islands = 0;

  function dfs(r, c) {
    if (r < 0 || c < 0 || r >= m || c >= n || grid[r][c] !== '1') return;
    grid[r][c] = '0';
    dfs(r + 1, c);
    dfs(r - 1, c);
    dfs(r, c + 1);
    dfs(r, c - 1);
  }

  for (let r = 0; r < m; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] === '1') {
        islands++;
        dfs(r, c);
      }
    }
  }
  return islands;
}

const fs = require('fs');
const lines = fs.readFileSync(0, 'utf-8').trim().split(/\\r?\\n/);
if (lines.length > 0) {
  const [m, n] = lines[0].trim().split(/\\s+/).map(Number);
  const grid = [];
  for (let i = 1; i <= m && i < lines.length; i++) {
    const row = lines[i].trim().split(/\\s+/);
    grid.push(row);
  }
  console.log(numIslands(grid));
}
`,
      python: `import sys

def num_islands(grid):
    if not grid:
        return 0
    m, n = len(grid), len(grid[0])
    count = 0

    def dfs(r, c):
        if r < 0 or c < 0 or r >= m or c >= n or grid[r][c] != '1':
            return
        grid[r][c] = '0'
        dfs(r + 1, c)
        dfs(r - 1, c)
        dfs(r, c + 1)
        dfs(r, c - 1)

    for r in range(m):
        for c in range(n):
            if grid[r][c] == '1':
                count += 1
                dfs(r, c)
    return count

if __name__ == '__main__':
    lines = sys.stdin.read().strip().splitlines()
    if lines:
        m, n = map(int, lines[0].split())
        grid = [lines[i].split() for i in range(1, m + 1)]
        print(num_islands(grid))
`,
      cpp: `#include <iostream>
#include <vector>

using namespace std;

void dfs(vector<vector<char>>& grid, int r, int c, int m, int n) {
    if (r < 0 || c < 0 || r >= m || c >= n || grid[r][c] != '1') return;
    grid[r][c] = '0';
    dfs(grid, r + 1, c, m, n);
    dfs(grid, r - 1, c, m, n);
    dfs(grid, r, c + 1, m, n);
    dfs(grid, r, c - 1, m, n);
}

int numIslands(vector<vector<char>>& grid) {
    int m = grid.size(), n = grid[0].size();
    int islands = 0;
    for (int r = 0; r < m; ++r) {
        for (int c = 0; c < n; ++c) {
            if (grid[r][c] == '1') {
                islands++;
                dfs(grid, r, c, m, n);
            }
        }
    }
    return islands;
}

int main() {
    int m, n;
    if (cin >> m >> n) {
        vector<vector<char>> grid(m, vector<char>(n));
        for (int i = 0; i < m; ++i) {
            for (int j = 0; j < n; ++j) cin >> grid[i][j];
        }
        cout << numIslands(grid) << endl;
    }
    return 0;
}
`,
      java: `import java.util.*;

public class Main {
    static void dfs(char[][] grid, int r, int c, int m, int n) {
        if (r < 0 || c < 0 || r >= m || c >= n || grid[r][c] != '1') return;
        grid[r][c] = '0';
        dfs(grid, r + 1, c, m, n);
        dfs(grid, r - 1, c, m, n);
        dfs(grid, r, c + 1, m, n);
        dfs(grid, r, c - 1, m, n);
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int m = sc.nextInt();
            int n = sc.nextInt();
            char[][] grid = new char[m][n];
            for (int i = 0; i < m; i++) {
                for (int j = 0; j < n; j++) {
                    grid[i][j] = sc.next().charAt(0);
                }
            }
            int ans = 0;
            for (int i = 0; i < m; i++) {
                for (int j = 0; j < n; j++) {
                    if (grid[i][j] == '1') {
                        ans++;
                        dfs(grid, i, j, m, n);
                    }
                }
            }
            System.out.println(ans);
        }
    }
}
`,
      c: `#include <stdio.h>

void dfs(char grid[305][305], int r, int c, int m, int n) {
    if (r < 0 || c < 0 || r >= m || c >= n || grid[r][c] != '1') return;
    grid[r][c] = '0';
    dfs(grid, r + 1, c, m, n);
    dfs(grid, r - 1, c, m, n);
    dfs(grid, r, c + 1, m, n);
    dfs(grid, r, c - 1, m, n);
}

int main() {
    int m, n;
    if (scanf("%d %d", &m, &n) != 2) return 0;
    char grid[305][305];
    for (int i = 0; i < m; i++) {
        for (int j = 0; j < n; j++) {
            scanf(" %c", &grid[i][j]);
        }
    }
    int count = 0;
    for (int i = 0; i < m; i++) {
        for (int j = 0; j < n; j++) {
            if (grid[i][j] == '1') {
                count++;
                dfs(grid, i, j, m, n);
            }
        }
    }
    printf("%d\\n", count);
    return 0;
}
`
    },
    sample_test_cases: [
      {
        input: '4 5\n1 1 1 1 0\n1 1 0 1 0\n1 1 0 0 0\n0 0 0 0 0',
        expected_output: '1',
        explanation: 'All adjacent 1s form a single connected island.'
      },
      {
        input: '4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1',
        expected_output: '3',
        explanation: 'Three separate islands.'
      }
    ],
    hidden_test_cases: [
      {
        input: '3 3\n1 0 1\n0 1 0\n1 0 1',
        expected_output: '5'
      },
      {
        input: '1 1\n0',
        expected_output: '0'
      }
    ],
    hints: [
      'Treat the 2D grid as an undirected graph with edges between horizontally and vertically adjacent 1s.',
      'Perform Depth-First Search (DFS) or Breadth-First Search (BFS) whenever you hit an unvisited 1.'
    ],
    editorial: {
      approach: 'Depth First Search (Connected Components)',
      algorithm: 'Iterate over grid. When land is found, increment counter and sink the entire connected island using DFS recursion.',
      time_complexity: 'O(m * n) - Each cell is visited at most once.',
      space_complexity: 'O(m * n) - Worst-case recursion stack if whole grid is land.',
      solution_code: `function numIslands(grid) {
  let count = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c] === '1') {
        count++;
        sink(grid, r, c);
      }
    }
  }
  return count;
}`
    }
  }
];

module.exports = { seedProblems };
