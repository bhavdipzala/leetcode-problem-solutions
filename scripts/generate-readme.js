#!/usr/bin/env node
/**
 * Regenerates the AUTO-GENERATED sections of the root README.
 *
 * This script only does file I/O: it reads solutions/{difficulty}/{dir}/meta.json,
 * hands the list to scripts/lib/rootReadmeTemplate.js and replaces the text
 * between each pair of markers. What the sections look like is decided entirely
 * in that template.
 *
 * Data comes from meta.json and never from a rendered per-problem README, except
 * as a fallback for a directory that has no meta.json (see readProblems()). That
 * is why changing the per-problem README template cannot break the root index.
 *
 * It uses only Node core modules, so the same file runs on the owner's machine
 * (the sync tool calls it after each commit) and in GitHub Actions
 * (update-readme.yml) with no install step.
 *
 * Usage: node scripts/generate-readme.js [repoRoot]
 */
const fs = require('fs');
const path = require('path');

/**
 * Best-effort recovery of a problem's data from its rendered README, used only
 * when meta.json is missing (for example a solution added by hand). Difficulty
 * is not parsed from the README, which shows it as a badge image; it comes from
 * the folder (easy, medium or hard) the directory was found in.
 *
 * Every sync writes a meta.json, and `node scripts/regenerate-all.js` backfills
 * any that is missing, after which this path is not taken for that problem.
 */
function parseProblemReadmeFallback(dirPath, dirName, difficultyLabel, parseDirName) {
  const readmePath = path.join(dirPath, 'README.md');
  if (!fs.existsSync(readmePath)) return null;
  const content = fs.readFileSync(readmePath, 'utf8');

  const parsed = parseDirName(dirName);
  if (!parsed) return null;
  const number = parsed.problemNumber;
  // parsed.slug is null only when the naming convention has no slug
  // (includeSlug: false), so fall back to the number.
  const slug = parsed.slug || String(number);

  // The header's LeetCode and Topics lines are list items ("- **LeetCode:** ...").
  // Their values are matched with [ \t]*(.*) and not \s*(.+), so an empty value
  // (a solution with no topics) stays empty instead of the match running across
  // the newline and returning the next line's text. regenerate-all.js keeps its
  // own copy of these patterns in backfillMeta(), because the two scripts are
  // standalone; the copies must stay identical.
  const titleLine = content.match(/^#\s*LeetCode\s+\d+\.\s*(.+)$/m);
  const urlLine = content.match(/^- \*\*LeetCode:\*\*[ \t]*(.*)$/m);
  const topicsLine = content.match(/^- \*\*Topics:\*\*[ \t]*(.*)$/m);

  return {
    number,
    title: titleLine ? titleLine[1].trim() : slug,
    url: (urlLine && urlLine[1].trim()) || `https://leetcode.com/problems/${slug}/`,
    difficulty: difficultyLabel,
    topics: topicsLine ? topicsLine[1].trim() : '',
    // A rendered README does not record when the problem was first synced, and
    // this script does not search git history to guess; regenerate-all.js
    // estimates it once when it backfills meta.json. It is null rather than
    // absent so the entry has the same shape as one read from meta.json, and the
    // Problems table can place it after every dated entry.
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
                `"${difficultyLabel}". It is listed under "${difficultyLabel}" (its actual folder) until this is ` +
                'reconciled. Run `node scripts/regenerate-all.js` after fixing meta.json by hand if this needs to move.'
            );
          }
          const numberMismatch = problemNumberMismatch(entry.name, meta);
          if (numberMismatch) {
            warn(
              `solutions/${relDirName}: meta.json says problemNumber ${numberMismatch.metaNumber} but the ` +
                `directory name encodes ${numberMismatch.nameNumber}. It is listed as LC${numberMismatch.metaNumber} ` +
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
            // Passed through as stored (an ISO 8601 string). It is set once, at a
            // problem's first sync, and never rewritten by a resubmission or by
            // regenerate-all.js, which is why the Problems table orders by it
            // (see rootReadmeTemplate.js). null when meta.json has no such
            // field. Interpreting it, including an unparseable value, is the
            // template's job.
            firstSyncedAt: meta.firstSyncedAt != null ? meta.firstSyncedAt : null,
          });
        } catch (e) {
          warn(`Skipping solutions/${relDirName}: unreadable meta.json (${e.message})`);
        }
        continue;
      }

      // No meta.json: recover what we can rather than dropping a solved
      // problem from the index.
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
        'instead. This works, but run `node scripts/regenerate-all.js` once to backfill meta.json for ' +
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
 * Regenerates the root README in repoRoot and returns true if the file changed
 * (or would change, in dryRun mode).
 *
 * options.dryRun: report whether the file would change without writing it.
 * regenerate-all.js --check uses this.
 * options.collectWarnings: an array that receives the warnings readProblems()
 * prints.
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
