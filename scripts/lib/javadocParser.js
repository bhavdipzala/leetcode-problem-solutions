/**
 * ===========================================================================
 * MASTER JAVADOC METADATA PARSER
 * ===========================================================================
 * Parses the optional `Approach:` / `Time:` / `Space:` fields out of a
 * Javadoc block (`/** ... *\/`) at the top of a submitted Java solution.
 *
 * Lives inside your solutions repo (not the sync toolkit) on purpose —
 * edit it directly, any time. The local sync service re-requires this
 * file fresh on every submission, and scripts/regenerate-all.js loads the
 * same copy when re-rendering past solutions, so there is exactly one
 * implementation of the parsing rules and no restart is needed to pick up
 * an edit.
 *
 * Rules:
 *  - The Javadoc block itself is optional.
 *  - Each of the three fields is independently optional.
 *  - A field's value may span multiple lines; those lines belong to it
 *    until the next recognised field label (or the end of the comment).
 *    The physical line structure is preserved exactly — a field's lines
 *    are joined with "\n", blank lines included. Turning that into
 *    markdown line breaks is a presentation decision and lives in the
 *    per-problem README template, not here.
 *  - Missing/empty fields resolve to an empty string, never undefined.
 *  - Line endings may be LF or CRLF, and the comment may use the usual
 *    leading ` * ` gutter or no gutter at all.
 *  - This module never modifies the source code — it only reads it.
 *
 * "The metadata block" has exactly one definition in this file:
 * locateJavadocBlock() picks the Javadoc comment the fields are read from
 * (see TOP_LEVEL_TYPE_DECL below for which comment counts), and
 * findMetadataBlock() additionally requires that it actually carries at
 * least one Approach/Time/Space label. parseJavadoc(), extractJavadocBlock(),
 * findMetadataBlock() and stripMetadataBlock() all go through it, so the
 * span the per-problem README leaves out of the embedded source can never
 * drift from the span the fields were actually read from.
 */

const FIELD_PATTERN = /^(Approach|Time|Space)\s*:\s*(.*)$/i;
const FIELD_KEYS = ['approach', 'time', 'space'];

// CRLF-safe: a bare split on "\n" would leave a trailing "\r" on every line,
// and FIELD_PATTERN's `.` does not match "\r", so no label would ever match.
const LINE_BREAK = /\r\n|\r|\n/;
const STAR_GUTTER = /^[ \t]*\*/;

// A real top-level type declaration always starts a line (only preceded by
// whitespace/modifiers) — a comment line always has a leading gutter
// character first, and prose inside the Javadoc would too. Anchoring the
// search to "before the first such line" keeps a `/** ... */`-shaped string
// literal or comment further down in a method body (e.g. inside a helper
// that builds output text) from ever being picked up as the metadata block,
// while leaving normal package/import lines above the class untouched.
const TOP_LEVEL_TYPE_DECL = /^[ \t]*(?:public\s+|final\s+|abstract\s+|static\s+)*(?:class|interface|enum|record)\s+\w/m;

/**
 * The one place that decides which Javadoc comment is "the" block: the first
 * `/** ... *\/` that appears before the first top-level type declaration.
 * Returns { start, end, inner } — `start`/`end` are string indices of the
 * whole comment, delimiters included (`source.slice(start, end)` is exactly
 * the comment), and `inner` is the text between the delimiters. Indices are
 * into String(code || ''). Null if there is no such comment.
 */
function locateJavadocBlock(code) {
  const source = String(code || '');
  const declMatch = source.match(TOP_LEVEL_TYPE_DECL);
  const searchWindow = declMatch ? source.slice(0, declMatch.index) : source;
  const match = searchWindow.match(/\/\*\*([\s\S]*?)\*\//);
  if (!match) return null;
  return { start: match.index, end: match.index + match[0].length, inner: match[1] };
}

function extractJavadocBlock(code) {
  const block = locateJavadocBlock(code);
  return block ? block.inner : null;
}

function stripCommentPrefix(line) {
  // Removes a leading Javadoc gutter like " * " or "*", keeps the rest as-is.
  return line.replace(/^[ \t]*\*[ \t]?/, '').replace(/[ \t]+$/, '');
}

/**
 * The comment's physical lines with its decoration removed.
 *
 * Gutter style (any line starts with `*`): each line has its own gutter
 * stripped, exactly as it always has been. No-gutter style (no line does):
 * the block's common left margin is removed instead, so a comment indented
 * as a whole still has its labels at the start of the line; indentation
 * beyond that margin (a nested list, say) is kept. The text on the opener's
 * own line (after `/**`) is never part of that margin.
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

/** Splits decoration-free lines into per-field line lists. `sawLabel` is true if ANY Approach/Time/Space label appeared. */
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
      // Ignore blank lines that appear before any real content for this
      // field (e.g. a lone blank line right after "Space:").
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
 * The exact span of the metadata block: the comment parseJavadoc() reads
 * the fields from, provided it actually carries at least one Approach/
 * Time/Space label. Returns { start, end, inner } (see locateJavadocBlock),
 * or null when there is no such comment.
 *
 * A first Javadoc with none of the three labels is deliberately NOT the
 * metadata block: it holds nothing that was extracted into the README, so
 * nothing about it is redundant, and it is left alone like any other
 * comment the author wrote.
 */
function findMetadataBlock(code) {
  const block = locateJavadocBlock(code);
  if (!block) return null;
  return scanFields(decorationFreeLines(block.inner)).sawLabel ? block : null;
}

/**
 * `code` with exactly the metadata block's span removed and nothing else —
 * no whitespace tidying, no other comment touched. Identical to the input
 * when there is no metadata block. (Presentation concerns such as trimming
 * leading blank lines belong to the caller.)
 */
function stripMetadataBlock(code) {
  const source = String(code || '');
  const block = findMetadataBlock(source);
  return block ? source.slice(0, block.start) + source.slice(block.end) : source;
}

module.exports = { parseJavadoc, extractJavadocBlock, findMetadataBlock, stripMetadataBlock };
