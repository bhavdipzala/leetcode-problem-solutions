/**
 * Parses the optional `Approach:`, `Time:` and `Space:` fields from the Javadoc
 * comment at the top of a submitted Java solution. It only reads the source. It
 * lives in the solutions repository so it can be edited directly; the sync service
 * and regenerate-all.js both load it, so the parsing rules have one implementation.
 *
 * Each field is optional, and a missing one is an empty string. A field's value
 * runs from its label to the next label or the end of the comment and keeps its
 * physical lines (joined with "\n", blank lines included); turning those into
 * Markdown line breaks is the README template's job. Line endings may be LF or
 * CRLF, and the comment may use a ` * ` gutter or none.
 *
 * LeetCode pre-fills a Javadoc above `class Solution` on linked-list, tree and
 * nested-list problems, so several comments can precede the class. The fields come
 * from the first one that carries a label; a comment with no label is left in the
 * embedded source. locateJavadocBlock() makes that choice once (TOP_LEVEL_TYPE_DECL
 * limits the candidates) and every exported function goes through it, so the span
 * the README drops from the embedded source is the one the fields came from.
 */

const FIELD_PATTERN = /^(Approach|Time|Space)\s*:\s*(.*)$/i;
const FIELD_KEYS = ['approach', 'time', 'space'];

// Splitting on a bare "\n" would leave a trailing "\r" on every CRLF line, and
// the `.` in FIELD_PATTERN does not match "\r", so no label would ever match.
const LINE_BREAK = /\r\n|\r|\n/;
const STAR_GUTTER = /^[ \t]*\*/;

// The first top-level type declaration: a line that, after optional modifiers,
// starts with class, interface, enum or record. Only comments before it are
// candidates for the metadata block, so a `/** ... */`-shaped string or comment
// further down (inside a method body, say) is never mistaken for it. Package
// and import lines above the class are unaffected.
const TOP_LEVEL_TYPE_DECL = /^[ \t]*(?:public\s+|final\s+|abstract\s+|static\s+)*(?:class|interface|enum|record)\s+\w/m;

/**
 * Finds the metadata block: the first `/** ... *\/` before the first top-level
 * type declaration that carries at least one Approach, Time or Space label.
 * Unlabelled comments are skipped, so a template comment above the class cannot
 * hide the author's notes below it.
 *
 * Returns { start, end, inner }, or null if no comment qualifies. `start` and
 * `end` are indices into String(code || '') that cover the whole comment with
 * its delimiters, and `inner` is the text between them.
 */
function locateJavadocBlock(code) {
  const source = String(code || '');
  const declMatch = source.match(TOP_LEVEL_TYPE_DECL);
  const searchWindow = declMatch ? source.slice(0, declMatch.index) : source;
  const comments = /\/\*\*([\s\S]*?)\*\//g;
  let match;
  while ((match = comments.exec(searchWindow)) !== null) {
    if (scanFields(decorationFreeLines(match[1])).sawLabel) {
      return { start: match.index, end: match.index + match[0].length, inner: match[1] };
    }
  }
  return null;
}

function extractJavadocBlock(code) {
  const block = locateJavadocBlock(code);
  return block ? block.inner : null;
}

function stripCommentPrefix(line) {
  // Drops a leading gutter such as " * " or "*" and trailing whitespace, and
  // leaves the rest of the line as it is.
  return line.replace(/^[ \t]*\*[ \t]?/, '').replace(/[ \t]+$/, '');
}

/**
 * The comment's physical lines with its decoration removed.
 *
 * In gutter style (any line starts with `*`) each line loses its own gutter.
 * Otherwise the block's common left margin is removed, so a comment indented as
 * a whole still has its labels at the start of the line, while deeper
 * indentation (a nested list, say) is kept. The text on the opener's own line,
 * after `/**`, is never part of that margin.
 */
function decorationFreeLines(inner) {
  const rawLines = inner.split(LINE_BREAK);
  if (rawLines.some((line) => STAR_GUTTER.test(line))) {
    return rawLines.map(stripCommentPrefix);
  }

  const leading = (line) => line.match(/^[ \t]*/)[0].length;
  const margin = Math.min(
    Infinity,
    ...rawLines.slice(1).filter((line) => line.trim() !== '').map(leading)
  );
  return rawLines.map((line, i) => {
    const stripped = i === 0 || !Number.isFinite(margin) ? line : line.slice(Math.min(margin, leading(line)));
    return stripped.replace(/[ \t]+$/, '');
  });
}

/** Splits decoration-free lines into per-field line lists. `sawLabel` is true if any label appeared. */
function scanFields(lines) {
  const fields = { approach: [], time: [], space: [] };
  let current = null;
  let sawLabel = false;

  for (const line of lines) {
    const m = line.match(FIELD_PATTERN);
    if (m) {
      sawLabel = true;
      const key = m[1].toLowerCase();
      current = key;
      const rest = m[2];
      if (rest && rest.trim().length > 0) {
        fields[key].push(rest);
      }
      continue;
    }

    if (current) {
      // Skip blank lines before the field's first content line, such as a
      // lone blank line right after "Space:".
      if (line.trim().length === 0 && fields[current].length === 0) {
        continue;
      }
      fields[current].push(line);
    }
    // Lines before any recognised field label are free text and ignored.
  }

  return { fields, sawLabel };
}

function parseJavadoc(code) {
  const result = { approach: '', time: '', space: '' };

  const block = locateJavadocBlock(code);
  if (!block) return result;

  const { fields } = scanFields(decorationFreeLines(block.inner));

  for (const key of FIELD_KEYS) {
    const lines = fields[key];
    while (lines.length && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    result[key] = lines.join('\n').trim();
  }

  return result;
}

/**
 * The exact span of the metadata block, the comment parseJavadoc() reads the
 * fields from. Returns { start, end, inner } (see locateJavadocBlock), or null
 * when no comment before the class carries a label.
 *
 * A Javadoc with none of the three labels is deliberately not the metadata
 * block. Nothing in it was extracted into the README, so it is not redundant
 * there, and it stays in the embedded source like any other comment the author
 * wrote (LeetCode's own template comment, for one).
 */
function findMetadataBlock(code) {
  return locateJavadocBlock(code);
}

/**
 * `code` with exactly the metadata block's span removed and nothing else: no
 * whitespace tidying and no other comment touched. Identical to the input when
 * there is no metadata block. Presentation concerns such as trimming leading
 * blank lines belong to the caller.
 */
function stripMetadataBlock(code) {
  const source = String(code || '');
  const block = findMetadataBlock(source);
  return block ? source.slice(0, block.start) + source.slice(block.end) : source;
}

module.exports = { parseJavadoc, extractJavadocBlock, findMetadataBlock, stripMetadataBlock };
