/**
 * ===========================================================================
 * MASTER ROOT README TEMPLATE
 * ===========================================================================
 * This is the one place that decides what goes inside the root README's
 * AUTO-GENERATED sections. Lives inside your solutions repo (not the sync
 * toolkit) on purpose — edit it directly, any time.
 *
 * `problems` is an array built from every solution's meta.json:
 *   { number, title, url, difficulty, topics, dirName, firstSyncedAt }
 * (`topics` arrives as a single comma-joined string, `dirName` is relative
 * to solutions/, e.g. "medium/LC-0015-3sum", and `firstSyncedAt` is the
 * ISO-8601 timestamp of the problem's first sync — or null when that's
 * genuinely unavailable, e.g. an entry recovered from its rendered README
 * because its meta.json is missing.)
 *
 * Each difficulty's Problems table is ordered most-recently-solved first,
 * by `firstSyncedAt` specifically (never `lastSyncedAt`): it's set once, at
 * a problem's first sync, and never changes afterward, so resubmitting an
 * improved solution — or hand-editing a Javadoc and re-running
 * regenerate-all.js — never moves a problem up the list.
 *
 * To restyle an existing section, edit the corresponding function below.
 * To ADD a brand-new section: add a key to buildSections(), and add its
 * matching <!-- AUTO-GENERATED:START/END:NAME --> markers to README.md
 * once, by hand. No regenerate-all.js needed for root README changes —
 * generate-readme.js already re-runs on every sync and every push, so an
 * edit here takes effect on your very next commit.
 */

// A literal "|" or newline in a title/topic would otherwise split or
// corrupt a markdown table row. LeetCode's own titles and topic tags never
// contain either in practice, but this table is rebuilt from whatever data
// happens to be sitting in each solutions/*/meta.json — including entries
// backfilled from an older README by hand — so it's cheap to make that
// assumption unnecessary.
function escapeCell(value) {
  return String(value == null ? '' : value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function buildBadges(problems) {
  const total = problems.length;
  const badge = (label, message, color) =>
    `![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(message)}-${color})`;
  return [badge('Language', 'Java', 'orange'), badge('Solved', String(total), 'blue'), badge('License', 'MIT', 'green')].join(' ');
}

// Purely decorative: how wide the Progress table's bar is, and the two
// block characters it's drawn with. Monochrome on purpose — both follow the
// reader's own text color, so the bar is legible in GitHub's light and dark
// themes alike (colored emoji squares would need an emoji font and have no
// neutral "empty" square that looks right in both themes). Each row already
// names its difficulty, so color would add little.
const PROGRESS_BAR_WIDTH = 20;
const PROGRESS_BAR_FILLED = '█';
const PROGRESS_BAR_EMPTY = '░';

/**
 * A fixed-width bar showing `count` as a share of `total` — every bar is
 * exactly `width` characters, so the column never jitters. Reuses counts
 * the caller already has; nothing new is computed from the data.
 *
 *   - `total` of 0 (or anything non-finite) is guarded, not divided by:
 *     every bar is simply an empty track.
 *   - A count of 0 is always an empty track; any count above 0 always shows
 *     at least one filled block, so a single Hard among fifty Easy is still
 *     visible rather than rounding away to nothing.
 *   - A count at or above `total` is exactly a full bar, never longer.
 */
function buildProgressBar(count, total, width = PROGRESS_BAR_WIDTH) {
  const c = Number(count);
  const t = Number(total);
  let filled = 0;
  if (Number.isFinite(c) && Number.isFinite(t) && c > 0 && t > 0) {
    filled = Math.min(width, Math.max(1, Math.round((c / t) * width)));
  }
  return PROGRESS_BAR_FILLED.repeat(filled) + PROGRESS_BAR_EMPTY.repeat(width - filled);
}

function buildProgressTable(problems) {
  const counts = { Easy: 0, Medium: 0, Hard: 0 };
  for (const p of problems) {
    if (counts[p.difficulty] !== undefined) counts[p.difficulty] += 1;
  }
  const total = problems.length;
  const row = (label, count) => `| ${label} | ${count} | ${buildProgressBar(count, total)} |`;
  return [
    '| Difficulty | Solved | Share |',
    '|------------|-------:|-------|',
    row('Easy', counts.Easy),
    row('Medium', counts.Medium),
    row('Hard', counts.Hard),
    `| **Total** | **${total}** | |`,
  ].join('\n');
}

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];

/** A firstSyncedAt value as epoch milliseconds, or null if it's missing or unparseable (never NaN). */
function toTimestamp(value) {
  if (value == null || value === '') return null;
  const t = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(t) ? t : null;
}

/** Ascending numeric compare that stays a consistent total order even for non-numeric input (those sort last). */
function compareNumbers(x, y) {
  const nx = Number(x);
  const ny = Number(y);
  const fx = Number.isFinite(nx);
  const fy = Number.isFinite(ny);
  if (fx && fy) return nx === ny ? 0 : nx < ny ? -1 : 1;
  if (fx) return -1;
  if (fy) return 1;
  return 0;
}

/**
 * Most recently solved first, by firstSyncedAt. A total, deterministic
 * order — this same script runs locally and in GitHub Actions, and both
 * must produce byte-identical output for the same repo, so nothing here may
 * depend on input order, filesystem listing order, or the machine's locale:
 *
 *   1. Entries with a usable date come before entries without one.
 *   2. Among dated entries: newer firstSyncedAt first.
 *   3. Same instant, or neither has a date (e.g. recovered from a README
 *      because meta.json is missing): LeetCode# ascending.
 *   4. Still tied (same number twice — an anomaly): directory name, by plain
 *      code-unit comparison (deliberately not localeCompare, which is
 *      locale-dependent).
 */
function compareByRecentlySolved(a, b) {
  const ta = toTimestamp(a.firstSyncedAt);
  const tb = toTimestamp(b.firstSyncedAt);
  if (ta !== null && tb !== null) {
    if (ta !== tb) return ta > tb ? -1 : 1;
  } else if (ta !== null) {
    return -1;
  } else if (tb !== null) {
    return 1;
  }
  const byNumber = compareNumbers(a.number, b.number);
  if (byNumber !== 0) return byNumber;
  const da = String(a.dirName == null ? '' : a.dirName);
  const db = String(b.dirName == null ? '' : b.dirName);
  return da === db ? 0 : da < db ? -1 : 1;
}

/**
 * One difficulty's table, ordered most-recently-solved first (see
 * compareByRecentlySolved). Column 1 is a plain 1..N index recomputed from
 * whatever order that produces, so it reads as a recency rank — row 1 is
 * the problem solved most recently. LeetCode#, column 2, is never renumbered.
 */
function buildDifficultySection(difficulty, problemsInThisDifficulty) {
  const sorted = problemsInThisDifficulty.slice().sort(compareByRecentlySolved);
  const header = ['|   | LeetCode# | Title | Solution | Topics |', '|--:|----------:|-------|----------|--------|'];
  const rows = sorted.map(
    (p, i) =>
      `| ${i + 1} | ${p.number} | [${escapeCell(p.title)}](${p.url}) | ` +
      `[View Solution](./solutions/${p.dirName}/) | ${escapeCell(p.topics)} |`
  );
  return [`### ${difficulty}`, '', ...header, ...rows].join('\n');
}

function buildProblemsSections(problems) {
  const byDifficulty = { Easy: [], Medium: [], Hard: [] };
  for (const p of problems) {
    const key = DIFFICULTY_ORDER.find((d) => d.toLowerCase() === String(p.difficulty || '').trim().toLowerCase());
    (byDifficulty[key] || byDifficulty.Easy).push(p);
    if (!key) {
      console.warn(`Problem #${p.number} has an unrecognised difficulty "${p.difficulty}" — listed under Easy.`);
    }
  }
  return DIFFICULTY_ORDER.map((d) => buildDifficultySection(d, byDifficulty[d])).join('\n\n');
}

function buildTopicsBreakdown(problems) {
  const counts = {};
  for (const p of problems) {
    const topics = String(p.topics || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    for (const t of topics) counts[t] = (counts[t] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (sorted.length === 0) {
    return '_No topics yet — they show up here once you solve your first problem._';
  }
  const header = ['| Topic | Problems |', '|-------|--------:|'];
  const rows = sorted.map(([topic, count]) => `| ${escapeCell(topic)} | ${count} |`);
  return header.concat(rows).join('\n');
}

/**
 * Returns { SECTION_NAME: renderedMarkdown, ... }. Each key must match a
 * pair of AUTO-GENERATED markers in README.md.
 */
function buildSections(problems) {
  return {
    BADGES: buildBadges(problems),
    PROGRESS: buildProgressTable(problems),
    PROBLEMS: buildProblemsSections(problems),
    TOPICS: buildTopicsBreakdown(problems),
  };
}

module.exports = {
  buildSections,
  buildBadges,
  buildProgressBar,
  buildProgressTable,
  buildProblemsSections,
  compareByRecentlySolved,
  buildTopicsBreakdown,
  escapeCell,
};
