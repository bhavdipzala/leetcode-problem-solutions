# LeetCode Problem Solutions

<!-- AUTO-GENERATED:START:BADGES -->
![Language](https://img.shields.io/badge/Language-Java-orange) ![Solved](https://img.shields.io/badge/Solved-8-blue) ![License](https://img.shields.io/badge/License-MIT-green)
<!-- AUTO-GENERATED:END:BADGES -->

A running collection of my LeetCode problem solutions in Java, with short
notes on my approach and time/space complexity for each — organised by
difficulty and kept in sync automatically as I work through more problems.
Each entry reflects my current, most recently accepted solution for that
problem, not a history of every attempt, and every solution here has been
accepted and passed LeetCode's own test cases.

## Progress

<!-- AUTO-GENERATED:START:PROGRESS -->
| Difficulty | Solved | Share |
|------------|-------:|-------|
| Easy | 5 | █████████████░░░░░░░ |
| Medium | 3 | ████████░░░░░░░░░░░░ |
| Hard | 0 | ░░░░░░░░░░░░░░░░░░░░ |
| **Total** | **8** | |
<!-- AUTO-GENERATED:END:PROGRESS -->

## Problems

<!-- AUTO-GENERATED:START:PROBLEMS -->
### Easy

|   | LeetCode# | Title | Solution | Topics |
|--:|----------:|-------|----------|--------|
| 1 | 14 | [Longest Common Prefix](https://leetcode.com/problems/longest-common-prefix/) | [View Solution](./solutions/easy/LC-0014-longest-common-prefix/) | Array, String, Trie |
| 2 | 9 | [Palindrome Number](https://leetcode.com/problems/palindrome-number/) | [View Solution](./solutions/easy/LC-0009-palindrome-number/) | Math |
| 3 | 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | [View Solution](./solutions/easy/LC-0001-two-sum/) | Array, Hash Table |
| 4 | 27 | [Remove Element](https://leetcode.com/problems/remove-element/) | [View Solution](./solutions/easy/LC-0027-remove-element/) | Array, Two Pointers |
| 5 | 26 | [Remove Duplicates from Sorted Array](https://leetcode.com/problems/remove-duplicates-from-sorted-array/) | [View Solution](./solutions/easy/LC-0026-remove-duplicates-from-sorted-array/) | Array, Two Pointers |

### Medium

|   | LeetCode# | Title | Solution | Topics |
|--:|----------:|-------|----------|--------|
| 1 | 3 | [Longest Substring Without Repeating Characters](https://leetcode.com/problems/longest-substring-without-repeating-characters/) | [View Solution](./solutions/medium/LC-0003-longest-substring-without-repeating-characters/) | Hash Table, String, Sliding Window |
| 2 | 15 | [3Sum](https://leetcode.com/problems/3sum/) | [View Solution](./solutions/medium/LC-0015-3sum/) | Array, Two Pointers, Sorting |
| 3 | 2 | [Add Two Numbers](https://leetcode.com/problems/add-two-numbers/) | [View Solution](./solutions/medium/LC-0002-add-two-numbers/) | Linked List, Math, Recursion |

### Hard

|   | LeetCode# | Title | Solution | Topics |
|--:|----------:|-------|----------|--------|
<!-- AUTO-GENERATED:END:PROBLEMS -->

## Topics Breakdown

<!-- AUTO-GENERATED:START:TOPICS -->
| Topic | Problems |
|-------|--------:|
| Array | 5 |
| Two Pointers | 3 |
| Hash Table | 2 |
| Math | 2 |
| String | 2 |
| Linked List | 1 |
| Recursion | 1 |
| Sliding Window | 1 |
| Sorting | 1 |
| Trie | 1 |
<!-- AUTO-GENERATED:END:TOPICS -->

## Repository Structure

```
leetcode-problem-solutions/
├── solutions/
│   ├── easy/
│   │   ├── LC-{problem-number}-{problem-title}/
│   │   │   ├── meta.json
│   │   │   ├── README.md
│   │   │   └── {problem-title}.java
│   │   └── ...
│   ├── medium/
│   │   └── ...
│   └── hard/
│       └── ...
│
├── scripts/
│   ├── generate-readme.js   (rebuilds this file's generated sections)
│   ├── regenerate-all.js    (retroactively applies a template/naming change)
│   └── lib/                 (README/naming/commit-message design — edit anytime)
├── README.md
├── LICENSE
└── .github/
    └── workflows/
        └── update-readme.yml   (CI safety net — reconciles this file on every push)
```

Directories are grouped by difficulty first, then named
`LC-{4-digit problem number}-{slug}` — e.g. `solutions/medium/LC-0015-3sum/`
— so both the difficulty grouping and the zero-padded number keep
everything sorted correctly with nothing more than a plain alphabetical
file browser, GitHub's own included.

Each problem directory contains:
- `meta.json` — the canonical data for this solve (title, difficulty,
  topics, timestamps...); `README.md` is generated from it
- `README.md` — problem metadata, approach, and complexity
- `{problem-title}.java` — Java solution

## Repository Maintenance

Solutions are synced from LeetCode using a small local automation tool
built specifically for this repository. No third-party LeetCode-to-GitHub
service is used.

The repository is maintained through a custom local automation workflow
which detects accepted LeetCode solutions, collects the title, metadata,
and submitted code, and commits and pushes solution files to the
repository.
