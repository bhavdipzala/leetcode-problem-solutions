#!/usr/bin/env node
/**
 * Regenerates the AUTO-GENERATED sections of the root README.md.
 *
 * This script is deliberately "dumb": it only does I/O (reading
 * solutions/{difficulty}/{dir}/meta.json, replacing marker sections in
 * README.md) and has zero opinions about what the sections should look
 * like. All of that design lives in scripts/lib/rootReadmeTemplate.js —
 * see that file to customize the root README's design.
 *
 * Reads solutions/{difficulty}/{dir}/meta.json for its data — never the
 * rendered per-problem README.md, EXCEPT as a fallback (see
 * readProblems() below) for a directory that's missing meta.json for any
 * reason (hand-added, hand-edited, or otherwise created outside the
 * normal sync flow). That means changing the per-problem README template
 * (scripts/lib/problemReadmeTemplate.js) can never break this script for
 * any solution that already has a meta.json: meta.json is the data, each
 * template is just one view of it.
 *
 * Dependency-free (only Node core `fs`/`path`) so it can run both:
 *   - locally, invoked by the sync service right after each commit, and
 *   - in CI, invoked by .github/workflows/update-readme.yml
 * using the exact same logic.
 *
 * Usage: node scripts/generate-readme.js [repoRoot]
 */
const fs = require('fs');
const path = require('path');

/**
 * Best-effort recovery of a problem's data from its rendered README.md,
 * used only when solutions/{difficulty}/{dir}/meta.json is missing —
 * e.g. a solution added or hand-edited outside the normal sync flow.
 * Difficulty is NOT parsed from the README text (the README shows it as
 * a badge image, not plain text, precisely so nothing needs to regex a
 * rendering decision back into data) — it comes from which of
 * solutions/easy|medium|hard/ the directory was actually found under,
 * which is both simpler and more reliable.
 *
 * Never used once a directory has a meta.json (which every sync writes,
 * and which `node scripts/regenerate-all.js` backfills for anything
 * missing one — see that script to permanently clear this fallback path
 * for every problem in one pass, rather than relying on it indefinitely).
 */
function parseProblemReadmeFallback(dirPath, dirName, difficultyLabel, parseDirName) {
  const readmePath = path.join(dirPath, 'README.md');
  if (!fs.existsSync(readmePath)) return null;
  const content = fs.readFileSync(readmePath, 'utf8');

  const parsed = parseDirName(dirName);
  if (!parsed) return null;
  const number = parsed.problemNumber;
  // Genuinely unavailable (rather than merely empty) only when the
  // current convention doesn't encode a slug at all (includeSlug: false).
  const slug = parsed.slug || String(number);

  const titleLine = content.match(/^#\s*LeetCode\s+\d+\.\s*(.+)$/m);
  const urlLine = content.match(/^\*\*LeetCode:\*\*\s*(.+)$/m);
  const topicsLine = content.match(/^\*\*Topics:\*\*\s*(.+)$/m);

  return {
    number,
    title: titleLine ? titleLine[1].trim() : slug,
    url: urlLine ? urlLine[1].trim() : `https://leetcode.com/problems/${slug}/`,
    difficulty: difficultyLabel,
    topics: topicsLine ? topicsLine[1].trim() : '',
    // A rendered README carries no reliable record of when the problem was
    // first synced (unlike meta.json), and this script deliberately does no
    // git archaeology to guess — regenerate-all.js's backfill is what
    // estimates it, once, into a real meta.json. Explicitly null rather than
    // absent, so the entry has the same shape as a meta.json-sourced one and
    // the Problems table's ordering can place it deterministically (after
    // every dated entry) instead of guessing.
    firstSyncedAt: null,
  };
}

function readProblems(repoRoot, options = {}) {
  const { collectWarnings } = options;
  const warn = (msg) => {
    console.warn(msg);
    if (collectWarnings) collectWarnings.push(msg);
  };

  const solutionsDir = path.join(repoRoot, 'solutions');
  if (!fs.existsSync(solutionsDir)) return [];

  const pathsLibPath = path.join(repoRoot, 'scripts', 'lib', 'paths.js');
  delete require.cache[require.resolve(pathsLibPath)];
  const { DIFFICULTY_DIRS, problemNumberMismatch, parseDirName } = require(pathsLibPath);

  const problems = [];
  let fallbackCount = 0;

  for (const diffFolder of DIFFICULTY_DIRS) {
    const diffPath = path.join(solutionsDir, diffFolder);
    if (!fs.existsSync(diffPath)) continue;
    const difficultyLabel = diffFolder.charAt(0).toUpperCase() + diffFolder.slice(1);

    const dirs = fs.readdirSync(diffPath, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const entry of dirs) {
      const dirPath = path.join(diffPath, entry.name);
      const relDirName = path.join(diffFolder, entry.name);
      const metaPath = path.join(dirPath, 'meta.json');

      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          if (meta.difficulty && meta.difficulty !== difficultyLabel) {
            warn(
              `solutions/${relDirName}: meta.json says difficulty "${meta.difficulty}" but it's filed under ` +
                `"${difficultyLabel}" — listed under "${difficultyLabel}" (its actual folder) until this is ` +
                'reconciled. Run `node scripts/regenerate-all.js` after fixing meta.json by hand if this needs to move.'
            );
          }
          const numberMismatch = problemNumberMismatch(entry.name, meta);
          if (numberMismatch) {
            warn(
              `solutions/${relDirName}: meta.json says problemNumber ${numberMismatch.metaNumber} but the ` +
                `directory name encodes ${numberMismatch.nameNumber} — listed as LC${numberMismatch.metaNumber} ` +
                '(meta.json\'s value) below; please repair this by hand so both agree.'
            );
          }
          problems.push({
            number: meta.problemNumber,
            title: meta.title,
            url: meta.url,
            difficulty: difficultyLabel,
            topics: Array.isArray(meta.topics) ? meta.topics.join(', ') : String(meta.topics || ''),
            dirName: relDirName,
            // Passed through as-is (the ISO-8601 string meta.json holds). Set
            // once at a problem's first sync and never rewritten by a
            // resubmission or by regenerate-all.js, which is exactly why the
            // Problems table orders by it (see rootReadmeTemplate.js). null
            // when meta.json has no such field; interpreting it — including
            // an unparseable value — is the template's job, not this
            // script's.
            firstSyncedAt: meta.firstSyncedAt != null ? meta.firstSyncedAt : null,
          });
        } catch (e) {
          warn(`Skipping solutions/${relDirName}: unreadable meta.json (${e.message})`);
        }
        continue;
      }

      // No meta.json — recover what we can rather than silently dropping
      // a real solved problem out of the index.
      const fallback = parseProblemReadmeFallback(dirPath, entry.name, difficultyLabel, parseDirName);
      if (fallback) {
        fallbackCount += 1;
        problems.push({ ...fallback, dirName: relDirName });
      } else {
        warn(`Skipping solutions/${relDirName}: no meta.json and no readable/recognisable README.md.`);
      }
    }
  }

  if (fallbackCount > 0) {
    warn(
      `${fallbackCount} solution(s) are missing meta.json and were recovered from their rendered README ` +
        'instead — this works, but run `node scripts/regenerate-all.js` once to backfill meta.json for ' +
        'them permanently (see README.md "Customizing later").'
    );
  }

  return problems;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceSection(content, name, body) {
  const start = `<!-- AUTO-GENERATED:START:${name} -->`;
  const end = `<!-- AUTO-GENERATED:END:${name} -->`;
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  if (!pattern.test(content)) {
    throw new Error(
      `Markers for section "${name}" not found in README.md. If you added a new section to ` +
        'scripts/lib/rootReadmeTemplate.js, add its <!-- AUTO-GENERATED:START/END:NAME --> markers to README.md too.'
    );
  }
  return content.replace(pattern, `${start}\n${body}\n${end}`);
}

function loadTemplate(repoRoot) {
  const templatePath = path.join(repoRoot, 'scripts', 'lib', 'rootReadmeTemplate.js');
  delete require.cache[require.resolve(templatePath)];
  return require(templatePath);
}

/**
 * Regenerates README.md in repoRoot. Returns true if the file changed
 * (or would change, in dryRun mode). With no options, behavior is
 * unchanged from before: reads current content, computes the desired
 * content, writes it if different.
 *
 * options.dryRun: computes and reports whether the file would change,
 * but never writes it — used by regenerate-all.js's --check mode. Never
 * true for any existing caller (repoManager.js's live-sync path, the
 * plain CLI invocation below) — this is purely additive.
 * options.collectWarnings: see readProblems() above.
 */
function regenerateRootReadme(repoRoot, options = {}) {
  const { dryRun = false, collectWarnings } = options;
  repoRoot = path.resolve(repoRoot);
  const readmePath = path.join(repoRoot, 'README.md');
  const original = fs.readFileSync(readmePath, 'utf8');

  const problems = readProblems(repoRoot, { collectWarnings });
  const { buildSections } = loadTemplate(repoRoot);
  const sections = buildSections(problems);

  let updated = original;
  for (const [name, body] of Object.entries(sections)) {
    updated = replaceSection(updated, name, body);
  }

  if (updated === original) return false;
  if (!dryRun) fs.writeFileSync(readmePath, updated, 'utf8');
  return true;
}

module.exports = { regenerateRootReadme, readProblems };

if (require.main === module) {
  const repoRoot = process.argv[2] || process.cwd();
  const changed = regenerateRootReadme(repoRoot);
  console.log(changed ? 'README.md updated.' : 'README.md already up to date.');
}
