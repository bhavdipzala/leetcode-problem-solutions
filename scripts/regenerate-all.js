#!/usr/bin/env node
/**
 * Re-renders EVERY per-problem README.md, and renames directories/files
 * to match the current naming convention, using what's on disk:
 *   - solutions/{difficulty}/{dir}/meta.json  -> the canonical LeetCode metadata
 *   - solutions/{difficulty}/{dir}/*.java     -> re-parsed for Approach/Time/Space
 *
 * This is what makes retroactive design changes possible. Want a
 * different README layout, or a different naming convention, after
 * you've already solved 100+ problems? Edit:
 *   - scripts/lib/problemReadmeTemplate.js  (README design)
 *   - scripts/lib/paths.js                  (directory/file naming)
 * then run:
 *
 *   node scripts/regenerate-all.js
 *
 * BACKFILLS meta.json AUTOMATICALLY for any directory that doesn't have
 * one yet — not just as a one-time migration step, but as ordinary
 * robustness: a solution you added or hand-edited outside the normal
 * sync flow gets reconstructed the same way. Problem number and Java
 * filename come from what's already on disk, title/topics/url are
 * recovered from the rendered README, difficulty comes from which of
 * solutions/easy|medium|hard/ it's actually sitting in (not parsed from
 * the README — the README shows difficulty as a badge image, not text),
 * and firstSyncedAt is estimated from that directory's earliest git
 * commit.
 *
 * Renames are done with `git mv` so history/blame is preserved. Nothing
 * is committed automatically by default — review with `git status` /
 * `git diff`, then commit and push yourself. Pass
 * `--commit "your message"` to have this script make a local commit
 * with exactly that message (it will never push, and it only ever
 * stages the files this run actually touched — never unrelated changes
 * that happen to be sitting in your working tree).
 *
 * Usage:
 *   node scripts/regenerate-all.js [repoRoot]
 *   node scripts/regenerate-all.js [repoRoot] --commit "chore: switch to a compact README layout"
 *   node scripts/regenerate-all.js [repoRoot] --check
 *
 * --check runs every detection this script already does -- naming-
 * convention conformance, F14 problem-number/directory mismatches,
 * missing/malformed meta.json, missing .java files, difficulty
 * mismatches, README/index staleness (including aggregate counts/
 * badges/ordering, not just individual entries), and an independent
 * structural scan for anything under solutions/ that the normal
 * per-difficulty discovery would never even look at in the first place
 * (a rogue top-level folder that isn't easy/medium/hard, a stray
 * non-directory file) -- and reports what it finds, but makes ZERO
 * writes of any kind: no file writes, no renames, no `git mv`, no
 * commits. Exits non-zero if anything was found, zero if the repo is
 * fully consistent -- safe to run unattended (see
 * .github/workflows/consistency-audit.yml) or by hand at any time.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// See git.js in the service package for why: never let a git call hang
// forever on a credential prompt with no terminal to answer it, even
// though this script is normally run interactively.
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' };

function loadLib(repoRoot) {
  const libDir = path.join(repoRoot, 'scripts', 'lib');
  for (const name of ['paths.js', 'javadocParser.js', 'problemReadmeTemplate.js']) {
    const p = path.join(libDir, name);
    delete require.cache[require.resolve(p)];
  }
  return {
    paths: require(path.join(libDir, 'paths.js')),
    javadoc: require(path.join(libDir, 'javadocParser.js')),
    template: require(path.join(libDir, 'problemReadmeTemplate.js')),
  };
}

function gitMv(repoRoot, from, to) {
  execFileSync('git', ['mv', from, to], { cwd: repoRoot, env: GIT_ENV });
}

/** Same temp-file-then-rename pattern as dedupStore.js — a crash mid-write can never leave a truncated meta.json. */
function writeJsonAtomic(filePath, data) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmpPath, filePath);
}

/** Best-effort: the earliest commit date touching this directory, ISO-8601. */
function earliestCommitDate(repoRoot, relativeDirPath) {
  try {
    const out = execFileSync(
      'git',
      ['log', '--follow', '--diff-filter=A', '--format=%aI', '--', relativeDirPath],
      { cwd: repoRoot, env: GIT_ENV, encoding: 'utf8' }
    ).trim();
    if (!out) return null;
    const lines = out.split('\n').filter(Boolean);
    return lines[lines.length - 1] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Reconstructs a meta.json for a directory that doesn't have one, using
 * only what's already on disk. Returns the meta object (written to disk
 * unless dryRun), or null if there wasn't enough information to safely
 * do it (no .java file, or a directory name that doesn't match the
 * naming convention at all) — the caller skips such a directory
 * entirely, same as it always could.
 *
 * dryRun: computes the exact same reconstructed meta object (so the
 * caller can still evaluate naming/README staleness against it) but
 * never calls writeJsonAtomic — used by --check mode, which must make
 * zero writes of any kind.
 */
function backfillMeta({ repoRoot, dirPath, entryName, difficultyLabel, parseDirName, dryRun = false }) {
  const javaFile = fs.readdirSync(dirPath).find((f) => f.endsWith('.java'));
  if (!javaFile) return null;

  const parsed = parseDirName(entryName);
  if (!parsed) return null;
  const problemNumber = parsed.problemNumber;
  // slugFromDir is only used below as a last-resort fallback for the URL
  // and titleSlug when the README doesn't have them either — genuinely
  // unavailable (rather than merely empty) when the current convention
  // doesn't encode a slug at all (NAMING_CONVENTION.includeSlug: false).
  const slugFromDir = parsed.slug || String(problemNumber);

  const readmePath = path.join(dirPath, 'README.md');
  const content = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';
  const titleLine = content.match(/^#\s*LeetCode\s+\d+\.\s*(.+)$/m);
  const urlLine = content.match(/^\*\*LeetCode:\*\*\s*(.+)$/m);
  const topicsLine = content.match(/^\*\*Topics:\*\*\s*(.+)$/m);

  const url = urlLine ? urlLine[1].trim() : `https://leetcode.com/problems/${slugFromDir}/`;
  const urlSlugMatch = url.match(/\/problems\/([^/]+)\/?/);

  const relativeDirPath = path.relative(repoRoot, dirPath);
  const firstSyncedAt = earliestCommitDate(repoRoot, relativeDirPath) || new Date().toISOString();

  const meta = {
    submissionId: null,
    problemNumber,
    title: titleLine ? titleLine[1].trim() : slugFromDir,
    titleSlug: urlSlugMatch ? urlSlugMatch[1] : slugFromDir,
    difficulty: difficultyLabel,
    topics: topicsLine
      ? topicsLine[1]
          .trim()
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    url,
    language: 'java',
    javaFileName: javaFile,
    firstSyncedAt,
    lastSyncedAt: new Date().toISOString(),
  };

  if (!dryRun) writeJsonAtomic(path.join(dirPath, 'meta.json'), meta);
  return meta;
}

/**
 * @param {string} repoRoot
 * @param {{dryRun?: boolean}} [options] - dryRun (default false): detects
 *   and reports every drift condition below via the returned `issues`
 *   array, but makes ZERO writes of any kind (no file writes, no
 *   renames/git mv, no commits) -- this is what --check mode uses. Every
 *   check below is the exact same detection call (parseDirName,
 *   problemNumberMismatch, solutionDirName, javaFileName, readProblems)
 *   the normal write path already uses; dryRun only ever gates the
 *   write/mutate step immediately after each one, never the detection
 *   itself, so there is exactly one implementation of "what counts as
 *   inconsistent" for both modes.
 * @returns {{changed: string[], touchedPaths: string[], issues: string[]}}
 *   `changed`/`touchedPaths` list what this run actually wrote (always
 *   empty when dryRun). `issues` lists every drift condition found that
 *   this run did NOT fix -- in write mode, only the handful of
 *   conditions regenerate-all.js has always refused to auto-fix (an F14
 *   mismatch, a missing .java file, an unrecoverable directory); in
 *   dryRun mode, everything, since dryRun fixes nothing.
 */
/**
 * Independent structural scan of solutions/ -- deliberately does NOT
 * reuse regenerateAll()'s own per-directory loop or readProblems(),
 * both of which only ever iterate the three known DIFFICULTY_DIRS and
 * so can never themselves notice something sitting outside that
 * structure in the first place; a check built only out of those two
 * would be blind to exactly the same class of thing F7 already fixed
 * once for the naming module itself. This walks solutions/ directly, at
 * both levels, and flags:
 *
 *   - anything at the top level of solutions/ that isn't a directory, or
 *     is a directory whose name isn't one of DIFFICULTY_DIRS -- its
 *     contents, however complete and valid-looking, are invisible to
 *     every other check in this file and to readProblems(), the same
 *     "invisible to the mechanism doing the checking" failure mode, one
 *     level up.
 *   - within each recognized difficulty folder, anything that isn't a
 *     directory, or a directory whose name doesn't parse under the
 *     CURRENT naming convention (via parseDirName). This overlaps with
 *     the naming-convention-mismatch check in the main loop below for
 *     the common case (valid meta.json present) -- deliberately: that
 *     overlap is two independent mechanisms agreeing, not one hiding
 *     behind the other, and this one alone still catches it when the
 *     main loop's own check never gets that far (e.g. meta.json is ALSO
 *     malformed, which makes the main loop stop at that error first).
 *
 * Purely diagnostic: never renames, moves, or deletes anything, and is
 * called identically in both modes -- there is no way to safely
 * auto-decide what a rogue folder or stray file *should* become.
 */
function findOrphanedEntries(repoRoot, lib) {
  const found = [];
  const solutionsDir = path.join(repoRoot, 'solutions');
  if (!fs.existsSync(solutionsDir)) return found;

  const difficultyDirs = new Set(lib.paths.DIFFICULTY_DIRS);
  const expected = lib.paths.DIFFICULTY_DIRS.join(', ');

  for (const topEntry of fs.readdirSync(solutionsDir, { withFileTypes: true })) {
    if (!topEntry.isDirectory()) {
      found.push(
        `solutions/${topEntry.name} is not a directory — not part of any recognized difficulty folder ` +
          `(expected one of: ${expected}). Invisible to normal discovery/regeneration.`
      );
      continue;
    }
    if (!difficultyDirs.has(topEntry.name)) {
      found.push(
        `solutions/${topEntry.name}/ is not a recognized difficulty folder (expected one of: ${expected}) — ` +
          'its contents, if any, are invisible to normal discovery/regeneration.'
      );
      continue;
    }

    const diffPath = path.join(solutionsDir, topEntry.name);
    for (const probEntry of fs.readdirSync(diffPath, { withFileTypes: true })) {
      if (!probEntry.isDirectory()) {
        found.push(`solutions/${topEntry.name}/${probEntry.name} is not a directory — unrecognized, invisible to normal discovery/regeneration.`);
        continue;
      }
      if (!lib.paths.parseDirName(probEntry.name)) {
        found.push(
          `solutions/${topEntry.name}/${probEntry.name}: directory name doesn't parse under the current naming ` +
            'convention (found by the independent structural scan of solutions/, which runs regardless of ' +
            "whether this directory's meta.json exists or is valid)."
        );
      }
    }
  }

  return found;
}

function regenerateAll(repoRoot, options = {}) {
  const dryRun = !!options.dryRun;
  repoRoot = path.resolve(repoRoot);
  const lib = loadLib(repoRoot);
  const solutionsDir = path.join(repoRoot, 'solutions');
  const changed = [];
  const touchedPaths = [];
  const issues = [];

  if (!fs.existsSync(solutionsDir)) {
    return { changed, touchedPaths, issues };
  }

  issues.push(...findOrphanedEntries(repoRoot, lib));

  for (const diffFolder of lib.paths.DIFFICULTY_DIRS) {
    const diffPath = path.join(solutionsDir, diffFolder);
    if (!fs.existsSync(diffPath)) continue;
    const difficultyLabel = diffFolder.charAt(0).toUpperCase() + diffFolder.slice(1);

    const dirs = fs.readdirSync(diffPath, { withFileTypes: true }).filter((e) => e.isDirectory());

    for (const entry of dirs) {
      const currentRelDirName = path.join(diffFolder, entry.name);
      const currentDirPath = path.join(solutionsDir, currentRelDirName);
      const metaPath = path.join(currentDirPath, 'meta.json');

      let meta;
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch (e) {
          // Write mode's behavior here predates --check and is
          // deliberately left exactly as it was (a hand-corrupted
          // meta.json is rare enough, and important enough, that
          // failing loudly rather than guessing has always been this
          // script's choice) -- only dryRun gets the new, additional
          // ability to report this and keep going, which is the whole
          // point of a check mode meant to run unattended.
          if (!dryRun) throw e;
          const msg = `Skipping solutions/${currentRelDirName}: meta.json exists but is not valid JSON (${e.message}).`;
          issues.push(msg);
          continue;
        }
      } else {
        meta = backfillMeta({
          repoRoot,
          dirPath: currentDirPath,
          entryName: entry.name,
          difficultyLabel,
          parseDirName: lib.paths.parseDirName,
          dryRun,
        });
        if (!meta) {
          const msg =
            `Skipping solutions/${currentRelDirName}: no meta.json, and couldn't reconstruct one ` +
            "(no .java file, or the directory name doesn't match the naming convention currently " +
            'configured in scripts/lib/paths.js).';
          console.warn(msg);
          issues.push(msg);
          continue;
        }
        if (dryRun) {
          issues.push(`solutions/${currentRelDirName}: meta.json is missing (would be backfilled from the .java file/README/git history).`);
        } else {
          changed.push(`backfilled solutions/${currentRelDirName}/meta.json`);
          touchedPaths.push(path.relative(repoRoot, path.join(currentDirPath, 'meta.json')));
        }
      }

      // meta.json can be syntactically valid and simply wrong (F14) — cross-
      // check its problemNumber against the number already encoded in this
      // directory's own (current) name before trusting it to compute a new
      // name below. Left unchecked, a mismatch here would get silently
      // baked in permanently: this script would rename the directory to
      // match the wrong number, destroying the one piece of evidence
      // (the original, correct directory name) that the record was ever
      // wrong in the first place. A freshly-backfilled meta above can never
      // trigger this, since its problemNumber is derived from the
      // directory name itself.
      const mismatch = lib.paths.problemNumberMismatch(entry.name, meta);
      if (mismatch) {
        const msg =
          `Skipping solutions/${currentRelDirName}: meta.json says problemNumber ${mismatch.metaNumber} but the ` +
          `directory name encodes ${mismatch.nameNumber} — these disagree. Not renaming or otherwise ` +
          "touching this directory automatically; please repair it by hand first (fix meta.json's " +
          'problemNumber, or rename the directory, so both agree), then re-run this script.';
        console.warn(msg);
        issues.push(msg);
        continue;
      }

      const javaFileCurrent = fs.readdirSync(currentDirPath).find((f) => f.endsWith('.java'));
      if (!javaFileCurrent) {
        const msg = `Skipping solutions/${currentRelDirName}: no .java file found.`;
        console.warn(msg);
        issues.push(msg);
        continue;
      }
      const javaCode = fs.readFileSync(path.join(currentDirPath, javaFileCurrent), 'utf8');
      const { approach, time, space } = lib.javadoc.parseJavadoc(javaCode);

      // Recompute the desired directory/file names under the CURRENT
      // naming convention in scripts/lib/paths.js — this naturally
      // includes moving to a different difficulty/ folder if meta.json's
      // difficulty ever differs from where the directory currently is.
      const desiredRelDirName = lib.paths.solutionDirName(meta);
      const desiredJavaFileName = lib.paths.javaFileName(meta);

      // In dryRun, nothing ever actually moves, so dirPath/relDirNameNow
      // stay pointed at the real, current, on-disk location throughout —
      // every later check in this iteration (the .java rename, the
      // meta.json field, the per-problem README) must keep reading from
      // where the files actually are, not the hypothetical new location.
      let dirPath = currentDirPath;
      let relDirNameNow = currentRelDirName;

      if (desiredRelDirName !== currentRelDirName) {
        if (dryRun) {
          issues.push(
            `solutions/${currentRelDirName}: directory name doesn't match the current naming convention ` +
              `(would rename to solutions/${desiredRelDirName}).`
          );
        } else {
          const desiredDirPath = path.join(solutionsDir, desiredRelDirName);
          fs.mkdirSync(path.dirname(desiredDirPath), { recursive: true }); // e.g. medium/ may not exist yet
          gitMv(repoRoot, path.relative(repoRoot, currentDirPath), path.relative(repoRoot, desiredDirPath));
          dirPath = desiredDirPath;
          relDirNameNow = desiredRelDirName;
          changed.push(`renamed solutions/${currentRelDirName} -> solutions/${desiredRelDirName}`);
        }
      }

      if (desiredJavaFileName !== javaFileCurrent) {
        if (dryRun) {
          issues.push(
            `solutions/${relDirNameNow}/${javaFileCurrent}: .java filename doesn't match the current naming ` +
              `convention for this solution (would rename to ${desiredJavaFileName}).`
          );
        } else {
          gitMv(
            repoRoot,
            path.relative(repoRoot, path.join(dirPath, javaFileCurrent)),
            path.relative(repoRoot, path.join(dirPath, desiredJavaFileName))
          );
          changed.push(
            `renamed solutions/${relDirNameNow}/${javaFileCurrent} -> solutions/${relDirNameNow}/${desiredJavaFileName}`
          );
        }
      }

      // meta.json's javaFileName should always reflect reality.
      const metaPathFinal = path.join(dirPath, 'meta.json');
      if (meta.javaFileName !== desiredJavaFileName) {
        if (dryRun) {
          issues.push(
            `solutions/${relDirNameNow}/meta.json: javaFileName field ("${meta.javaFileName}") is stale ` +
              `(would be updated to "${desiredJavaFileName}").`
          );
        } else {
          meta.javaFileName = desiredJavaFileName;
          writeJsonAtomic(metaPathFinal, meta);
          touchedPaths.push(path.relative(repoRoot, metaPathFinal));
        }
      }

      const readme = lib.template.buildProblemReadme({ ...meta, approach, time, space });
      const readmePath = path.join(dirPath, 'README.md');
      const previous = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : null;
      if (previous !== readme) {
        if (dryRun) {
          issues.push(`solutions/${relDirNameNow}/README.md is stale (would be regenerated from current meta.json + Javadoc).`);
        } else {
          fs.writeFileSync(readmePath, readme, 'utf8');
          changed.push(`regenerated solutions/${relDirNameNow}/README.md`);
          touchedPaths.push(path.relative(repoRoot, readmePath));
        }
      }
    }
  }

  // The root index is derived from meta.json (falling back to each
  // README for anything that still couldn't be backfilled above), so
  // refresh it too. collectWarnings surfaces readProblems()'s own
  // detection (difficulty mismatches, F14 mismatches encountered while
  // building the index, unreadable meta.json) into the same `issues`
  // list -- harmless and additive in write mode too, since it only adds
  // to the returned array; the console.warn calls those already make
  // are completely unchanged.
  const genPath = path.join(repoRoot, 'scripts', 'generate-readme.js');
  delete require.cache[require.resolve(genPath)];
  const { regenerateRootReadme } = require(genPath);
  const rootReadmeStale = regenerateRootReadme(repoRoot, { dryRun, collectWarnings: issues });
  if (rootReadmeStale) {
    if (dryRun) {
      issues.push('README.md (root index) is stale (would be regenerated).');
    } else {
      changed.push('regenerated README.md (root index)');
      touchedPaths.push('README.md');
    }
  }

  return { changed, touchedPaths: [...new Set(touchedPaths)], issues };
}

module.exports = { regenerateAll };

if (require.main === module) {
  const args = process.argv.slice(2);
  const checkMode = args.includes('--check');
  const commitIdx = args.indexOf('--commit');
  let commitMessage = null;
  let repoRoot;

  if (checkMode && commitIdx !== -1) {
    console.error('--check and --commit cannot be used together (--check never writes anything, so there is nothing to commit).');
    process.exit(1);
  }

  if (commitIdx !== -1) {
    commitMessage = args[commitIdx + 1];
    if (!commitMessage || commitMessage.trim() === '') {
      console.error('--commit requires a message: node scripts/regenerate-all.js --commit "your message here"');
      process.exit(1);
    }
    repoRoot = args.filter((_, i) => i !== commitIdx && i !== commitIdx + 1)[0] || process.cwd();
  } else if (checkMode) {
    repoRoot = args.filter((a) => a !== '--check')[0] || process.cwd();
  } else {
    repoRoot = args[0] || process.cwd();
  }

  if (checkMode) {
    // Read-only, by construction: dryRun makes regenerateAll() skip every
    // write/rename/commit step below the exact same detection calls the
    // normal path uses. See its own doc comment for the change/no-change
    // contract this relies on.
    const { issues } = regenerateAll(repoRoot, { dryRun: true });

    if (!issues.length) {
      console.log('Consistency check passed — no issues found. Nothing was changed (this mode never writes).');
      process.exit(0);
    } else {
      console.log(`Consistency check found ${issues.length} issue(s) (nothing was changed -- this mode never writes):`);
      issues.forEach((issue) => console.log('  - ' + issue));
      console.log('\nRun `node scripts/regenerate-all.js` (optionally with --commit) to fix what can be fixed automatically.');
      console.log('Anything above that was skipped rather than auto-fixed needs a manual repair first -- see its own message for what to fix.');
      process.exit(1);
    }
  }

  const { changed, touchedPaths } = regenerateAll(repoRoot);

  if (!changed.length) {
    console.log('Nothing changed — everything already matches the current templates/conventions.');
  } else {
    console.log(`Updated ${changed.length} item(s):`);
    changed.forEach((c) => console.log('  - ' + c));

    if (commitMessage) {
      // Scoped to exactly what this run touched — never `git add -A`, so
      // an unrelated uncommitted change sitting in the working tree at
      // the time never rides along in this commit.
      execFileSync('git', ['add', '--', ...touchedPaths], { cwd: path.resolve(repoRoot), env: GIT_ENV });
      execFileSync('git', ['commit', '-m', commitMessage], { cwd: path.resolve(repoRoot), env: GIT_ENV });
      console.log(`\nCommitted locally as: ${commitMessage}\nReview with \`git show\`, then \`git push\` when ready.`);
    } else {
      console.log('\nNothing committed yet. Review with `git status` / `git diff`, then commit and push yourself.');
      console.log('(Or re-run with --commit "your message" to have this script make that commit for you — it will never push.)');
    }
  }
}
