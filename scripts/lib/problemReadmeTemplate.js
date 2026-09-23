/**
 * ===========================================================================
 * MASTER PER-PROBLEM README TEMPLATE
 * ===========================================================================
 * This is the one place that decides what a solution's README.md looks
 * like. Lives inside your solutions repo (not the sync toolkit) on
 * purpose — edit it directly, any time.
 *
 * Every field it receives comes from solutions/{dir}/meta.json (the
 * canonical LeetCode metadata, written once when a problem is first
 * synced and refreshed on every resubmission) plus approach/time/space,
 * which are parsed fresh from the solution's Javadoc every time — so
 * editing an old Javadoc comment and re-running regenerate-all.js picks
 * up the change too.
 *
 * To change the README design:
 *   1. Edit buildProblemReadme() below however you like — reorder
 *      sections, add new ones (e.g. a Runtime/Memory line, a "Solved on"
 *      date using meta.lastSyncedAt), restyle headings, etc.
 *   2. Run:  node scripts/regenerate-all.js
 *      This re-renders every existing solution's README.md to match.
 *   3. Review with `git diff`, then commit and push.
 *
 * Section order and headings, in this fixed sequence — matching
 * buildProblemReadme() below exactly: a one-line "Back to all solutions"
 * link to the root README, a header (title, LeetCode link, difficulty
 * badge, topics), then `## Approach`, `## Complexity` (Time/Space), and
 * `## Solution` (a link to the .java file). Each
 * section below is built as its own array of lines and only includes a
 * blank "content" line when there's real content to show — sections are
 * joined with a single blank line between them. That's what collapses
 * "## Approach" straight into "## Complexity" with exactly one blank
 * line between them when Approach is empty, instead of leaving stray
 * extra blank lines where the missing content would have gone.
 *
 * `meta` contains: submissionId, problemNumber, title, titleSlug,
 * difficulty, topics (array), url, language, javaFileName,
 * firstSyncedAt, lastSyncedAt — plus anything else you add to meta.json
 * yourself — and, spread in alongside it, the freshly-parsed approach/
 * time/space.
 */
// Relative path from a per-problem README back to the repo's root README.
// A per-problem README lives at solutions/{difficulty}/{dir}/README.md (the
// layout scripts/lib/paths.js defines), so the repo root is three levels up:
// {dir} -> {difficulty} -> solutions -> root. This is depth, not a name, so
// unlike the directory name itself it doesn't change with the naming
// convention — it would only need updating if that three-level layout did.
const ROOT_README_RELATIVE_PATH = '../../../README.md';

const DIFFICULTY_BADGE_COLOR = { Easy: 'brightgreen', Medium: 'yellow', Hard: 'red' };

function difficultyBadge(difficulty) {
  const color = DIFFICULTY_BADGE_COLOR[difficulty] || 'lightgrey';
  return `![${difficulty}](https://img.shields.io/badge/-${encodeURIComponent(difficulty)}-${color})`;
}

function buildProblemReadme(meta) {
  const { problemNumber, title, url, difficulty, topics, approach, time, space, javaFileName } = meta;
  const topicsStr = Array.isArray(topics) ? topics.join(', ') : String(topics || '');

  const navLines = [`[← Back to all solutions](${ROOT_README_RELATIVE_PATH})`];

  const headerLines = [
    `# LeetCode ${problemNumber}. ${title}`,
    '',
    `**LeetCode:** ${url}`,
    `**Difficulty:** ${difficultyBadge(difficulty)}`,
    `**Topics:** ${topicsStr}`,
  ];

  const approachLines = approach ? ['## Approach', '', approach] : ['## Approach'];

  const complexityLines = [
    '## Complexity',
    '',
    `- **Time:**${time ? ' ' + time : ''}`,
    `- **Space:**${space ? ' ' + space : ''}`,
  ];

  const solutionLines = ['## Solution', '', `[View Solution](./${javaFileName})`];

  const sections = [navLines, headerLines, approachLines, complexityLines, solutionLines].map((section) => section.join('\n'));

  return sections.join('\n\n') + '\n';
}

module.exports = { buildProblemReadme };
