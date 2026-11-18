/**
 * Builds the generated sections of the root README (BADGES, PROGRESS, PROBLEMS,
 * TOPICS). This is the one place that decides what goes between the
 * AUTO-GENERATED markers, and it lives in the solutions repository so it can be
 * edited directly. generate-readme.js already runs on every sync and push, so an
 * edit here applies to the next commit with no need for regenerate-all.js. To add
 * a section, add a key to buildSections() and its marker pair to the root README.
 *
 * `problems` is an array built from every solution's meta.json:
 *   { number, title, url, difficulty, topics, dirName, firstSyncedAt }
 * `topics` is one comma-joined string, `dirName` is relative to solutions/ (for
 * example "medium/LC-0015-3sum"), and `firstSyncedAt` is the ISO 8601 time of the
 * first sync, or null when unavailable (an entry recovered without meta.json).
 *
 * Problems are ordered most recently solved first, by `firstSyncedAt` and never
 * `lastSyncedAt`. It is set once and never changes, so resubmitting an improved
 * solution, or editing a Javadoc and re-running regenerate-all.js, does not move
 * a problem up the list.
 */

// A literal "|" or newline in a title or topic would split or corrupt a Markdown
// table row. LeetCode's own titles and topic tags do not contain either, but the
// tables are rebuilt from whatever is in each meta.json, including entries
// edited by hand, so it is cheap to stop relying on that.
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

// Captions: one italic line at the top of each generated section, then a blank
// line, then the section's content. They live here, next to the behaviour they
// describe (the Problems caption states the order compareByRecentlySolved()
// implements), and not in the static README text, so a caption cannot drift
// from what is generated.
const PROGRESS_CAPTION = '_Problems solved so far, with a breakdown by difficulty._';
const PROBLEMS_CAPTION = '_Problems solved, ordered by date solved within each difficulty, most recent first._';
const TOPICS_CAPTION = '_Problems solved per topic. A problem can have multiple topics, so the counts overlap._';

// How wide the Progress table's bar is at 100%, and the block character it is
// drawn with. The character is monochrome on purpose: it takes the reader's own
// text colour, so the bar is legible in GitHub's light and dark themes alike
// (coloured emoji squares would need an emoji font), and each row already names
// its difficulty.
const PROGRESS_BAR_WIDTH = 20;
const PROGRESS_BAR_FILLED = '█';

/**
 * A bar showing `count` as a share of `total` (the count across all difficulties
 * combined), scaled against a fixed `width` so bars are comparable between rows.
 * Only filled blocks are drawn and there is no empty track, so a bar is between 0
 * and `width` characters long.
 *
 *   - A `total` of 0, or anything non-finite, is guarded rather than divided by:
 *     every bar is empty.
 *   - A count of 0 is an empty bar (the "Solved" column already states it). Any
 *     count above 0 shows at least one block, so a single Hard among fifty Easy
 *     does not round away to nothing.
 *   - A count at or above `total` is exactly a full bar, never longer.
 */
function buildProgressBar(count, total, width = PROGRESS_BAR_WIDTH) {
  const c = Number(count);
  const t = Number(total);
  let filled = 0;
  if (Number.isFinite(c) && Number.isFinite(t) && c > 0 && t > 0) {
    filled = Math.min(width, Math.max(1, Math.round((c / t) * width)));
  }
  return PROGRESS_BAR_FILLED.repeat(filled);
}

function buildProgressTable(problems) {
  const counts = { Easy: 0, Medium: 0, Hard: 0 };
  for (const p of problems) {
    if (counts[p.difficulty] !== undefined) counts[p.difficulty] += 1;
  }
  const total = problems.length;
  const row = (label, count) => `| ${label} | ${count} | ${buildProgressBar(count, total)} |`;
  return [
    PROGRESS_CAPTION,
    '',
    '| Difficulty | Solved | Share |',
    '|------------|-------:|-------|',
    row('Easy', counts.Easy),
    row('Medium', counts.Medium),
    row('Hard', counts.Hard),
    `| **Total** | **${total}** | |`,
  ].join('\n');
}

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];

/** A firstSyncedAt value as epoch milliseconds, or null if it is missing or unparseable (never NaN). */
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
 * Ascending string compare by plain UTF-16 code unit, the one string comparison
 * this file uses. It is deliberately not String#localeCompare, which depends on
 * the machine's locale: the same script runs locally and in GitHub Actions and
 * must render byte-identical output in both.
 */
function compareCodeUnits(x, y) {
  return x === y ? 0 : x < y ? -1 : 1;
}

/**
 * Most recently solved first, by firstSyncedAt. This is a total, deterministic
 * order: the same script runs locally and in GitHub Actions and both must produce
 * byte-identical output for the same repository, so nothing here may depend on
 * input order, filesystem listing order or the machine's locale.
 *
 *   1. Entries with a usable date come before entries without one.
 *   2. Among dated entries, the newer firstSyncedAt comes first.
 *   3. Same instant, or neither dated (for example recovered from a README
 *      because meta.json is missing): LeetCode number ascending.
 *   4. Still tied (the same number twice, which is an anomaly): directory name by
 *      code-unit comparison (compareCodeUnits).
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
  return compareCodeUnits(String(a.dirName == null ? '' : a.dirName), String(b.dirName == null ? '' : b.dirName));
}

/**
 * Link text for the Problem column, "{LeetCode number}. {title}", safe to put
 * inside a Markdown link inside a table cell. On top of escapeCell() (a "|" or
 * newline cannot split the row), backslashes and square brackets are escaped, so
 * no title can end the link text early or turn into a second link, whatever
 * LeetCode or a hand-edited meta.json puts in it. Backslashes are escaped first
 * so that an escape added here is not itself swallowed by one already in the
 * title.
 */
function escapeLinkText(value) {
  return escapeCell(
    String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
  );
}

/**
 * One difficulty's table, ordered most recently solved first (see
 * compareByRecentlySolved). Column 1 is a plain 1..N index recomputed from that
 * order, so it reads as a recency rank: row 1 is the problem solved most
 * recently. The Problem column is one Markdown link to the problem on LeetCode
 * with the real LeetCode number in the link text. That number is never
 * renumbered and is unrelated to the rank in column 1.
 */
function buildDifficultySection(difficulty, problemsInThisDifficulty) {
  const sorted = problemsInThisDifficulty.slice().sort(compareByRecentlySolved);
  const header = ['|   | Problem | Solution | Topics |', '|--:|---------|----------|--------|'];
  const rows = sorted.map((p, i) => {
    const linkText = escapeLinkText(`${p.number == null ? '' : p.number}. ${p.title == null ? '' : p.title}`);
    return `| ${i + 1} | [${linkText}](${p.url}) | [View](./solutions/${p.dirName}/) | ${escapeCell(p.topics)} |`;
  });
  return [`### ${difficulty}`, '', ...header, ...rows].join('\n');
}

function buildProblemsSections(problems) {
  const byDifficulty = { Easy: [], Medium: [], Hard: [] };
  for (const p of problems) {
    const key = DIFFICULTY_ORDER.find((d) => d.toLowerCase() === String(p.difficulty || '').trim().toLowerCase());
    (byDifficulty[key] || byDifficulty.Easy).push(p);
    if (!key) {
      console.warn(`Problem #${p.number} has an unrecognised difficulty "${p.difficulty}". It is listed under Easy.`);
    }
  }
  return [PROBLEMS_CAPTION, '', DIFFICULTY_ORDER.map((d) => buildDifficultySection(d, byDifficulty[d])).join('\n\n')].join('\n');
}

/**
 * Splits an already-ranked list into the two halves of the side-by-side Topics
 * layout: the higher-ranked half on the left and the remainder on the right,
 * never interleaved. An odd count puts the extra one on the left
 * (13 -> 7 + 6, 14 -> 7 + 7).
 */
function splitTopicColumns(ranked) {
  const leftCount = Math.ceil(ranked.length / 2);
  return { left: ranked.slice(0, leftCount), right: ranked.slice(leftCount) };
}

function buildTopicTable(entries) {
  const header = ['| Topic | Problems |', '|-------|--------:|'];
  const rows = entries.map(([topic, count]) => `| ${escapeCell(topic)} | ${count} |`);
  return header.concat(rows).join('\n');
}

/**
 * Topics ranked by problem count, ties broken by plain code-unit order (so every
 * uppercase letter sorts before every lowercase one), the same locale-independent
 * comparison the Problems ordering uses. That matters here: in the side-by-side
 * layout a tie that straddles the midpoint decides which table a topic lands in,
 * so it cannot depend on the machine's locale.
 *
 * With two or more topics the section is two independent Markdown tables side by
 * side, inside a raw HTML <table> with one table per <td>. With one topic it is a
 * single table, and with none a short placeholder. The blank lines around the HTML
 * tags are load-bearing: GitHub parses pipe-table syntax inside a raw HTML block
 * only when a blank line separates it from the tags, and without the one after an
 * opening tag the rows come out as literal "| a | b |" text. The ones before the
 * closing tags are not required, since a closing tag ends a table by itself, but
 * are kept so no renderer has to guess where a table ends. valign="top" keeps the
 * shorter table at the top when the count is odd. The layout does not reflow on a
 * narrow viewport the way a single table would; that trade-off is accepted.
 */
function buildTopicsBreakdown(problems) {
  const counts = {};
  for (const p of problems) {
    const topics = String(p.topics || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    for (const t of topics) counts[t] = (counts[t] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1] || compareCodeUnits(a[0], b[0]));

  if (sorted.length === 0) {
    return [TOPICS_CAPTION, '', '_No topics yet. They show up here once you solve your first problem._'].join('\n');
  }
  if (sorted.length === 1) {
    return [TOPICS_CAPTION, '', buildTopicTable(sorted)].join('\n');
  }

  const { left, right } = splitTopicColumns(sorted);
  return [
    TOPICS_CAPTION,
    '',
    '<table><tr><td valign="top">',
    '',
    buildTopicTable(left),
    '',
    '</td><td valign="top">',
    '',
    buildTopicTable(right),
    '',
    '</td></tr></table>',
  ].join('\n');
}

/**
 * Returns { SECTION_NAME: renderedMarkdown, ... }. Each key must match a pair of
 * AUTO-GENERATED markers in the root README.
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
  splitTopicColumns,
  escapeCell,
  escapeLinkText,
};
