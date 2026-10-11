# LeetCode Problem Solutions

<!-- AUTO-GENERATED:START:BADGES -->
![Language](https://img.shields.io/badge/Language-Java-orange) ![Solved](https://img.shields.io/badge/Solved-1-blue) ![License](https://img.shields.io/badge/License-MIT-green)
<!-- AUTO-GENERATED:END:BADGES -->

A running collection of my LeetCode problem solutions in Java, with short notes on my approach and time/space complexity for each.<br>
Solutions are organised by difficulty and synced automatically from my accepted LeetCode solutions using a small local automation tool built specifically for this repository as I work through more problems.<br>
Each entry reflects my current, most recently accepted solution for that problem, not a history of every attempt, and every solution here has been accepted and passed LeetCode's own test cases.

## Progress

<!-- AUTO-GENERATED:START:PROGRESS -->
_Problems solved so far, with a breakdown by difficulty._

| Difficulty | Solved | Share |
|------------|-------:|-------|
| Easy | 1 | ████████████████████ |
| Medium | 0 |  |
| Hard | 0 |  |
| **Total** | **1** | |
<!-- AUTO-GENERATED:END:PROGRESS -->

## Problems

<!-- AUTO-GENERATED:START:PROBLEMS -->
_Problems solved, ordered by date solved within each difficulty, most recent first._

### Easy

|   | Problem | Solution | Topics |
|--:|---------|----------|--------|
| 1 | [1. Two Sum](https://leetcode.com/problems/two-sum/) | [View](./solutions/easy/LC-0001-two-sum/) | Array, Hash Table |

### Medium

|   | Problem | Solution | Topics |
|--:|---------|----------|--------|

### Hard

|   | Problem | Solution | Topics |
|--:|---------|----------|--------|
<!-- AUTO-GENERATED:END:PROBLEMS -->

## Topics Breakdown

<!-- AUTO-GENERATED:START:TOPICS -->
_Problems solved per topic. A problem can have multiple topics, so the counts overlap._

<table><tr><td valign="top">

| Topic | Problems |
|-------|--------:|
| Array | 1 |

</td><td valign="top">

| Topic | Problems |
|-------|--------:|
| Hash Table | 1 |

</td></tr></table>
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
│   └── lib/                 (README/naming/commit-message design)
├── README.md
├── LICENSE
└── .github/
    └── workflows/
        ├── update-readme.yml      (reconciles this file on every push)
        └── consistency-audit.yml  (scheduled integrity check, read-only)
```

Directories are grouped by difficulty first, then named `LC-{4-digit problem number}-{slug}`, for example `solutions/medium/LC-0012-integer-to-roman/`.

Each problem directory contains:
- `meta.json`: the canonical data for this solve (title, difficulty, topics, timestamps...); `README.md` is generated from it
- `README.md`: problem metadata, approach, complexity, and the full solution source
- `{problem-title}.java`: the submitted Java solution on its own

## Repository Maintenance

Solutions are synced from LeetCode using a small local automation tool built specifically for this repository. No third-party LeetCode-to-GitHub service is used.

The repository is maintained through a custom local automation workflow which detects accepted LeetCode solutions, collects the title, metadata, and submitted code, and commits and pushes solution files to the repository. A separate scheduled check runs independently to confirm the repository stays internally consistent over time.
