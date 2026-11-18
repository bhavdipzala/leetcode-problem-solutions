/**
 * Builds the README for one solution. This is the one place that decides what
 * that file looks like, and it lives in the solutions repository so it can be
 * edited directly. After a change, run `node scripts/regenerate-all.js` to
 * re-render the existing solutions, then review with `git diff`.
 *
 * Inputs are the fields of meta.json, the approach, time and space parsed fresh
 * from the Javadoc on every render, and `code`, the exact text of the .java file
 * (so the embedded copy cannot drift from it). `code` is optional; without it the
 * Solution section is just the raw-file link. The Approach, Time and Space
 * Javadoc is left out of the embedded copy because the README already shows it,
 * and every other comment is kept.
 *
 * Each section is built as its own array of lines and the sections are joined
 * with one blank line, so an empty section collapses cleanly. The README starts
 * at the title because GitHub already shows a link back to the repository root
 * above every file.
 */
const { stripMetadataBlock } = require('./javadocParser.js');

const DIFFICULTY_BADGE_COLOR = { Easy: 'brightgreen', Medium: 'yellow', Hard: 'red' };

function difficultyBadge(difficulty) {
  const color = DIFFICULTY_BADGE_COLOR[difficulty] || 'lightgrey';
  return `![${difficulty}](https://img.shields.io/badge/-${encodeURIComponent(difficulty)}-${color})`;
}

// A Markdown list item: a bullet (-, *, +) or a numeric marker (1. or 1))
// followed by whitespace or the end of the line. "-5 is the minimum" and
// "*emphasis*" are ordinary text, not list items.
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])(?:\s|$)/;
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/;

// GFM tables inside an Approach.
//
// A table is made of ordinary text lines, so without special handling every row
// would get a "<br>" suffix, which breaks the delimiter row and adds a stray
// cell. These rules follow cmark-gfm (GitHub's parser) and were checked against
// it rather than assumed:
//
//   - A table is a header row directly followed by a delimiter row with the same
//     number of cells, the delimiter row indented at most three spaces. The
//     header can be any line that does not itself start another block, including
//     one with no "|" (`a` over `|---|` is a one-column table), and it may
//     directly follow a text line, which stays its own paragraph.
//   - Cells split on every "|" not escaped with a backslash, even inside a code span.
//   - Once started, a table runs through every following line, including one with
//     no "|" (a one-cell row), until a blank line or a line that begins another block.
//
// Not followed: cmark-gfm also accepts a header row indented four or more spaces
// right after a text line (it becomes a paragraph continuation). That mixed-indent
// shape is left as plain text.

const DELIMITER_CELL = /^[ \t]*:?-+:?[ \t]*$/;

const HTML_BLOCK_NAMES =
  'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|' +
  'fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|' +
  'main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|' +
  'title|tr|track|ul';

// Lines that begin a block of their own (CommonMark), other than the kinds
// already classified (blank, list item, code fence). Used only to decide where a
// table ends and whether a line can be a table's header row.
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
  // Only spaces and tabs are trimmed. cmark-gfm does not treat a no-break space
  // (or any other Unicode space) as padding, so one before the first "|" is a
  // cell of its own.
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
  // With no "|" and no ":" it is a setext underline or a thematic break ("---"), not a delimiter row.
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
    i = last + 2; // the next table's header row can be no earlier than the line after this one's last line
  }
}

/**
 * Turns an `approach` string (the parser's physical lines joined with "\n") into
 * Markdown that keeps the author's line structure. A single newline inside a
 * Markdown paragraph renders as a space, so a hand-broken approach would flatten
 * into one run-on line; this restores the breaks without guessing from
 * punctuation. Returns '' for an absent or blank approach.
 *
 *   - A "<br>" goes after a line only when that line and the next are both
 *     ordinary text.
 *   - A blank line is one paragraph break: runs of blanks collapse, leading and
 *     trailing blanks are dropped, and there is no trailing "<br>".
 *   - List items, and a text line directly above one, get plain newlines so a
 *     real list renders.
 *   - Code fences are left exactly as written, with no "<br>" in or next to one.
 *   - A GFM table never gets a "<br>" on any of its lines, nor does the text line
 *     directly above it (see the table rules above).
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

/**
 * The text embedded in the README: `code` with exactly the Approach/Time/Space
 * Javadoc block removed (javadocParser's definition of that block, see
 * stripMetadataBlock), any blank lines that leaves at the top dropped, and the
 * file's final line terminator dropped so the closing fence can sit on its own
 * line. Nothing else is touched: line endings, tabs, non-ASCII text and every
 * other comment come through as they are. Returns '' when `code` is not a string
 * or has nothing left to show.
 */
function embeddedSource(code) {
  if (typeof code !== 'string') return '';
  const withoutBlock = stripMetadataBlock(code).replace(/^(?:[ \t]*(?:\r\n|\r|\n))+/, '');
  if (withoutBlock.trim() === '') return '';
  return withoutBlock.replace(/(?:\r\n|\r|\n)$/, '');
}

/**
 * The fenced `java` code block for `code`, or '' if there is nothing to embed.
 * The fence is one backtick longer than the longest backtick run in the source
 * (never fewer than three), so source that itself contains ``` cannot close the
 * block early and corrupt the rest of the README.
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
