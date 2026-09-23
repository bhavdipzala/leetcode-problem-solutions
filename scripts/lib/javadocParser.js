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
 *  - Missing/empty fields resolve to an empty string, never undefined.
 *  - This module never modifies the source code — it only reads it.
 */

const FIELD_PATTERN = /^(Approach|Time|Space)\s*:\s*(.*)$/i;
const FIELD_KEYS = ['approach', 'time', 'space'];

// A real top-level type declaration always starts a line (only preceded by
// whitespace/modifiers) — a comment line always has a leading gutter
// character first, and prose inside the Javadoc would too. Anchoring the
// search to "before the first such line" keeps a `/** ... */`-shaped string
// literal or comment further down in a method body (e.g. inside a helper
// that builds output text) from ever being picked up as the metadata block,
// while leaving normal package/import lines above the class untouched.
const TOP_LEVEL_TYPE_DECL = /^[ \t]*(?:public\s+|final\s+|abstract\s+|static\s+)*(?:class|interface|enum|record)\s+\w/m;

function extractJavadocBlock(code) {
  const source = String(code || '');
  const declMatch = source.match(TOP_LEVEL_TYPE_DECL);
  const searchWindow = declMatch ? source.slice(0, declMatch.index) : source;
  const match = searchWindow.match(/\/\*\*([\s\S]*?)\*\//);
  return match ? match[1] : null;
}

function stripCommentPrefix(line) {
  // Removes a leading Javadoc gutter like " * " or "*", keeps the rest as-is.
  return line.replace(/^[ \t]*\*[ \t]?/, '').replace(/[ \t]+$/, '');
}

function parseJavadoc(code) {
  const result = { approach: '', time: '', space: '' };

  const block = extractJavadocBlock(code);
  if (!block) return result;

  const rawLines = block.split('\n').map(stripCommentPrefix);
  const fields = { approach: [], time: [], space: [] };
  let current = null;

  for (const line of rawLines) {
    const m = line.match(FIELD_PATTERN);
    if (m) {
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

  for (const key of FIELD_KEYS) {
    const lines = fields[key];
    while (lines.length && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    result[key] = lines.join('\n').trim();
  }

  return result;
}

module.exports = { parseJavadoc, extractJavadocBlock };
