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
 * up the change too — plus `code`, the solution's own source text (see
 * below).
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
 * buildProblemReadme() below exactly: a header (title, then a list of the
 * LeetCode link, difficulty badge and topics), then `## Approach`,
 * `## Complexity` (Time/Space), and `## Solution` (the full Java source in
 * a fenced code block, then a link to the raw .java file). The README
 * begins directly with the title — GitHub already shows a clickable
 * breadcrumb back to the repository root above every file. Each
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
 * time/space and `code`.
 *
 * `code` is the exact text of the solution's .java file — the very string
 * that is (live sync) or was (regenerate-all.js) written to disk, so the
 * embedded copy can never be a second, drifting version of it. It is
 * optional: with no `code` the Solution section is just the raw-file link.
 * The Approach/Time/Space Javadoc block is left out of the embedded copy
 * (it is already shown in its own sections above); every other comment is
 * kept. The .java file itself is never touched.
 */
const { stripMetadataBlock } = require('./javadocParser.js');

const DIFFICULTY_BADGE_COLOR = { Easy: 'brightgreen', Medium: 'yellow', Hard: 'red' };

function difficultyBadge(difficulty) {
  const color = DIFFICULTY_BADGE_COLOR[difficulty] || 'lightgrey';
  return `![${difficulty}](https://img.shields.io/badge/-${encodeURIComponent(difficulty)}-${color})`;
}

// ---------------------------------------------------------------------------
// Approach: preserving the author's line structure
// ---------------------------------------------------------------------------

// A markdown list item: a bullet (-, *, +) or a numeric marker (1. or 1))
// followed by whitespace or the end of the line — "-5 is the minimum" and
// "*emphasis*" are ordinary text, not list items.
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])(?:\s|$)/;
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/;

// ---------------------------------------------------------------------------
// GFM tables inside an Approach
//
// A table is made of ordinary text lines, so without special handling every
// row would get a "<br>" suffix — which breaks the delimiter row and adds a
// stray cell. The rules below match cmark-gfm (GitHub's own parser); each was
// checked against it directly rather than assumed:
//
//   - A table is a header row IMMEDIATELY followed by a delimiter row (cells
//     of "-" with optional leading/trailing ":", separated by "|", outer
//     pipes optional) with the SAME number of cells; the delimiter row is
//     indented at most three spaces. The header row is any line that does not
//     itself start another block (heading, blockquote, indented code, ...) —
//     it needn't contain a "|" (a one-column table is `a` over `|---|`) — and
//     it may directly follow a line of text with no blank line between: that
//     text stays its own paragraph and the table starts at the header row.
//     (Unequal cell counts, or a delimiter row indented four spaces, mean no
//     table at all; a prose line that merely contains "|" is not a header.)
//     One shape is not followed: cmark-gfm also accepts a header row indented
//     four or more spaces when a text line directly precedes it (it is then a
//     paragraph continuation); such a mixed-indent table is left as plain
//     text, since the delimiter row beneath it has to sit at three spaces or less.
//   - Cells are split on every "|" not escaped with a backslash — pipes
//     inside a `code span` still split, exactly as GFM does.
//   - Once started, a table runs through every following line — even one
//     with no "|", which becomes a one-cell row — until a blank line or a
//     line that begins another block (list item, code fence, heading,
//     blockquote, thematic break, HTML block, indented code).
// ---------------------------------------------------------------------------

const DELIMITER_CELL = /^[ \t]*:?-+:?[ \t]*$/;

const HTML_BLOCK_NAMES =
  'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|' +
  'fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|' +
  'main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|' +
  'title|tr|track|ul';

// Lines that begin a block of their own (CommonMark), other than the kinds
// already classified (blank, list item, code fence). Only used to decide
// where a table ends and whether a line can be a table's header row.
const OTHER_BLOCK_START = [
  /^ {0,3}#{1,6}(?:[ \t]|$)/, // ATX heading
  /^ {0,3}>/, // blockquote
  /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/, // thematic break
  /^(?: {4}| {0,3}\t)/, // indented code
  /^ {0,3}<(?:script|pre|style|textarea)(?:[ \t>]|$)/i, // HTML block, kind 1
  /^ {0,3}<(?:!--|\?|![A-Za-z]|!\[CDATA\[)/, // HTML block, kinds 2-5
  new RegExp(`^ {0,3}</?(?:${HTML_BLOCK_NAMES})(?:[ \\t]|/?>|$)`, 'i'), // HTML block, kind 6
  /^ {0,3}(?:<[A-Za-z][A-Za-z0-9-]*(?:[ \t]+[A-Za-z_:][\w.:-]*(?:[ \t]*=[ \t]*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*[ \t]*\/?>|<\/[A-Za-z][A-Za-z0-9-]*[ \t]*>)[ \t]*$/, // HTML block, kind 7: one whole tag alone on the line
];

const startsOtherBlock = (text) => OTHER_BLOCK_START.some((re) => re.test(text));

/**
 * A table row's cells: split on every "|" that is not backslash-escaped, with
 * one leading and one trailing pipe taken as the row's outer pipes rather
 * than as cell separators.
 */
function splitTableCells(line) {
  // Only spaces and tabs are trimmed: cmark-gfm does not treat a no-break space (or any other Unicode space) as padding,
  // so one sitting before the first "|" is a cell of its own.
  const text = line.replace(/^[ \t]+|[ \t]+$/g, '');
  const cells = [];
  let cell = '';
  let endedOnPipe = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    endedOnPipe = false;
    if (ch === '\\' && i + 1 < text.length) {
      cell += ch + text[i + 1];
      i += 1;
    } else if (ch === '|') {
      cells.push(cell);
      cell = '';
      endedOnPipe = true;
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  if (text.startsWith('|')) cells.shift();
  if (endedOnPipe) cells.pop();
  return cells;
}

function isDelimiterRow(line) {
  const body = line.match(/^ {0,3}(\S.*)$/);
  if (!body) return false;
  const cells = splitTableCells(body[1]);
  if (cells.length === 0 || !cells.every((cell) => DELIMITER_CELL.test(cell))) return false;
  // With no "|" and no ":" at all it is a setext underline or a thematic break ("---"), not a delimiter row.
  return body[1].includes('|') || body[1].includes(':');
}

/**
 * Marks every GFM table in `lines` (each { text, kind }) by changing its
 * lines' kind to 'table': the header row, the delimiter row and the rows
 * that follow, up to the line that ends the table. Only 'normal' lines can
 * start or continue one, so a table inside a code fence is never seen.
 */
function markTables(lines) {
  let i = 1;
  while (i < lines.length) {
    const header = lines[i - 1];
    const delimiter = lines[i];
    const isTable =
      header.kind === 'normal' &&
      delimiter.kind === 'normal' &&
      !startsOtherBlock(header.text) &&
      isDelimiterRow(delimiter.text) &&
      splitTableCells(header.text).length === splitTableCells(delimiter.text).length;
    if (!isTable) {
      i += 1;
      continue;
    }
    let last = i;
    while (last + 1 < lines.length && lines[last + 1].kind === 'normal' && !startsOtherBlock(lines[last + 1].text)) last += 1;
    for (let j = i - 1; j <= last; j++) lines[j].kind = 'table';
    i = last + 2; // the line after the table's last line can only be the next table's header row
  }
}

/**
 * Turns an `approach` string — the parser's faithful physical lines, joined
 * with "\n" — into markdown that keeps the author's own line structure. A
 * single newline inside a markdown paragraph renders as a space, which
 * would flatten a hand-broken approach into one run-on line; this restores
 * the breaks without ever guessing from punctuation (a full stop in the
 * middle of a line is never a break point — only the end of a real line
 * is).
 *
 *   - Two consecutive normal text lines are joined by "<br>" + newline.
 *   - A blank line between two parts is one real paragraph break (several
 *     blank lines collapse into one); leading/trailing blank lines are
 *     dropped, and there is never a trailing "<br>".
 *   - A "<br>" goes after a line only when that line AND the next are both
 *     normal text. List items (and a text line right before one) get plain
 *     newlines instead, so markdown renders a real list.
 *   - Code fences inside the approach are left exactly as written: no
 *     "<br>" inside (or directly around) one, and blank lines inside one
 *     are not collapsed.
 *   - A GFM table (header row, delimiter row, rows) never gets a "<br>" on
 *     any of its lines, nor does the text line directly above it — see
 *     "GFM tables inside an Approach" above for exactly where a table
 *     starts and ends. A prose line that merely contains "|" is not a table
 *     and keeps the normal rule.
 *
 * Returns '' for an absent/blank approach.
 */
function approachToMarkdown(approach) {
  if (approach == null) return '';
  const physical = String(approach)
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/[ \t]+$/, ''));

  // Classify every line: 'blank' | 'list' | 'fence' (a fence line, or a line inside one) | 'normal'.
  // (markTables() below then re-labels the lines of any GFM table as 'table'.)
  let openFence = null;
  const items = physical.map((text) => {
    if (openFence) {
      const closes = new RegExp(`^ {0,3}${openFence[0]}{${openFence.length},}\\s*$`).test(text);
      if (closes) openFence = null;
      return { text, kind: 'fence' };
    }
    const fence = text.match(FENCE_LINE);
    if (fence) {
      openFence = fence[1];
      return { text, kind: 'fence' };
    }
    if (text.trim() === '') return { text: '', kind: 'blank' };
    return { text, kind: LIST_ITEM.test(text) ? 'list' : 'normal' };
  });

  // Trim leading/trailing blank lines, and collapse each run of blanks into one.
  const kept = [];
  for (const item of items) {
    if (item.kind === 'blank' && (kept.length === 0 || kept[kept.length - 1].kind === 'blank')) continue;
    kept.push(item);
  }
  while (kept.length && kept[kept.length - 1].kind === 'blank') kept.pop();

  markTables(kept);

  return kept
    .map((item, i) => {
      const next = kept[i + 1];
      // A line directly above a delimiter-shaped row is never given a "<br>": for a
      // header row it would break the table, and for a near-miss (say "| a |" over
      // "|---|---|", whose cell counts differ) the extra "<br>" cell would turn
      // something GitHub shows as text into a table.
      const needsBreak = item.kind === 'normal' && next && next.kind === 'normal' && !isDelimiterRow(next.text);
      return needsBreak ? `${item.text}<br>` : item.text;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Solution: the embedded source
// ---------------------------------------------------------------------------

/**
 * The text embedded in the README: `code` with exactly the Approach/Time/
 * Space Javadoc block removed (javadocParser's own definition of that
 * block — see stripMetadataBlock), any blank lines that leaves at the top
 * dropped, and the file's own final line terminator dropped so the closing
 * fence can sit on its own line. Nothing else is touched: line endings,
 * tabs, unicode and every other comment come through as they are. Returns
 * '' when `code` isn't a string or has nothing left to show.
 */
function embeddedSource(code) {
  if (typeof code !== 'string') return '';
  const withoutBlock = stripMetadataBlock(code).replace(/^(?:[ \t]*(?:\r\n|\r|\n))+/, '');
  if (withoutBlock.trim() === '') return '';
  return withoutBlock.replace(/(?:\r\n|\r|\n)$/, '');
}

/**
 * The fenced `java` code block for `code`, or '' if there's nothing to
 * embed. The fence is one backtick longer than the longest backtick run in
 * the source (never fewer than three), so source that itself contains
 * ``` can't close the block early and corrupt the rest of the README.
 */
function buildCodeBlock(code) {
  const body = embeddedSource(code);
  if (!body) return '';
  const longestRun = (body.match(/`+/g) || []).reduce((max, run) => Math.max(max, run.length), 0);
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return `${fence}java\n${body}\n${fence}`;
}

function buildProblemReadme(meta) {
  const { problemNumber, title, url, difficulty, topics, approach, time, space, javaFileName, code } = meta;
  const topicsStr = Array.isArray(topics) ? topics.join(', ') : String(topics || '');

  const headerLines = [
    `# LeetCode ${problemNumber}. ${title}`,
    '',
    `- **LeetCode:** ${url}`,
    `- **Difficulty:** ${difficultyBadge(difficulty)}`,
    `- **Topics:** ${topicsStr}`,
  ];

  const approachText = approachToMarkdown(approach);
  const approachLines = approachText ? ['## Approach', '', approachText] : ['## Approach'];

  const complexityLines = [
    '## Complexity',
    '',
    `- **Time:**${time ? ' ' + time : ''}`,
    `- **Space:**${space ? ' ' + space : ''}`,
  ];

  const codeBlock = buildCodeBlock(code);
  const solutionLines = ['## Solution', ''];
  if (codeBlock) solutionLines.push(codeBlock, '');
  solutionLines.push(`[Raw .java file](./${javaFileName})`);

  const sections = [headerLines, approachLines, complexityLines, solutionLines].map((section) => section.join('\n'));

  return sections.join('\n\n') + '\n';
}

module.exports = { buildProblemReadme, approachToMarkdown, embeddedSource, buildCodeBlock };
