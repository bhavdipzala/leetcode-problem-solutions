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
 * Each generated section opens with a one-line italic caption (see the
 * *_CAPTION constants below). They are generated here, not typed into the
 * static README text, so the Problems caption — which states the sort
 * order — can never drift from the sort order this file actually
 * implements.
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

// Captions: one italic line at the top of each generated section, then a
// blank line, then the section's content. They live here — in the same
// file as the behavior they describe (the Problems caption states the sort
// order compareByRecentlySolved() implements) — rather than in the static
// README text, so a caption can't drift from what's actually generated.
const PROGRESS_CAPTION = '_Problems solved so far, with a breakdown by difficulty._';
const PROBLEMS_CAPTION = '_Problems solved, ordered by date solved within each difficulty, most recent first._';
const TOPICS_CAPTION = '_Problems solved per topic. A problem can have multiple topics, so the counts overlap._';

// Purely decorative: how wide the Progress table's bar is at 100%, and the
// block character it's drawn with. Monochrome on purpose — it follows the
// reader's own text color, so the bar is legible in GitHub's light and dark
// themes alike (colored emoji squares would need an emoji font). Each row
// already names its difficulty, so color would add little.
const PROGRESS_BAR_WIDTH = 20;
const PROGRESS_BAR_FILLED = '█';

/**
 * A bar showing `count` as a share of `total` (the count across ALL
 * difficulties combined), scaled against a fixed `width` — so bars are
 * directly comparable between rows. Only the filled blocks are drawn; there
 * is no empty track, so a bar is anywhere from 0 to `width` characters long.
 * Reuses counts the caller already has; nothing new is computed from the
 * data.
 *
 *   - `total` of 0 (or anything non-finite) is guarded, not divided by:
 *     every bar is simply empty.
 *   - A count of 0 is an empty bar (the adjacent "Solved" column already
 *     states the count); any count above 0 always shows at least one
 *     filled block, so a single Hard among fifty Easy is still visible
 *     rather than rounding away to nothing.
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
 * Ascending string compare by plain UTF-16 code unit — the one string
 * comparison this file uses. Deliberately not String#localeCompare, which
 * depends on the machine's locale: this same script runs locally and in
 * GitHub Actions and must render byte-identical output in both.
 */
function compareCodeUnits(x, y) {
  return x === y ? 0 : x < y ? -1 : 1;
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
 *      because meta.json is missing): LeetCode number ascending.
 *   4. Still tied (same number twice — an anomaly): directory name, by plain
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
 * Link text for the Problem column: "{LeetCode number}. {title}", safe to
 * put inside a markdown link inside a table cell. On top of escapeCell()'s
 * protection (a "|" or newline can't split the row), backslashes and square
 * brackets are backslash-escaped, so no title can ever end the link text
 * early or turn into a second link — whatever LeetCode, or a hand-edited
 * meta.json, puts in it. Backslashes are escaped first so an escape we add
 * is never itself swallowed by one already in the title.
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
 * One difficulty's table, ordered most-recently-solved first (see
 * compareByRecentlySolved). Column 1 is a plain 1..N index recomputed from
 * whatever order that produces, so it reads as a recency rank — row 1 is
 * the problem solved most recently. The Problem column is one plain
 * markdown link to the problem on LeetCode, with the real LeetCode number
 * inside the link text; that number is never renumbered, and is unrelated
 * to the rank in column 1.
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
      console.warn(`Problem #${p.number} has an unrecognised difficulty "${p.difficulty}" — listed under Easy.`);
    }
  }
  return [PROBLEMS_CAPTION, '', DIFFICULTY_ORDER.map((d) => buildDifficultySection(d, byDifficulty[d])).join('\n\n')].join('\n');
}

/**
 * Splits an already-ranked list into the two halves of the side-by-side
 * Topics layout: the higher-ranked half on the left, the remainder on the
 * right — never interleaved. An odd count puts the extra one on the left
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
 * Topics ranked by problem count, ties by plain code-unit order (so every
 * uppercase letter sorts before every lowercase one) — the same
 * locale-independent comparison the Problems ordering uses. That matters
 * here: with the side-by-side layout a tie that straddles the midpoint
 * decides which table a topic lands in, so it must not depend on the
 * machine's locale. With two or more topics they're shown as two
 * independent markdown tables side by side, which keeps this section from
 * becoming one very long single-column table; with one topic it's a single
 * plain table; with none, a short placeholder.
 *
 * The side-by-side layout is a raw HTML <table> with each markdown table
 * inside a <td>. The blank lines are load-bearing, not cosmetic: GitHub
 * only parses pipe-table syntax inside a raw HTML block when a blank line
 * separates it from the HTML tags around it (without the blank line after
 * an opening tag, the table's rows are swallowed by the HTML block and
 * come out as literal "| a | b |" text). The blank lines before the
 * closing tags aren't strictly required by GitHub's current renderer — a
 * closing tag interrupts a table by itself — but are kept so no renderer
 * has to guess where a table ends. valign="top" keeps the shorter table
 * pinned to the top rather than vertically centred when the count is odd.
 *
 * Known, accepted trade-off: this HTML layout doesn't reflow on a narrow
 * (mobile) viewport the way a single markdown table does.
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
    return [TOPICS_CAPTION, '', '_No topics yet — they show up here once you solve your first problem._'].join('\n');
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
  splitTopicColumns,
  escapeCell,
  escapeLinkText,
};
