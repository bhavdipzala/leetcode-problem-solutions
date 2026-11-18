#!/usr/bin/env node
/**
 * Re-renders every per-problem README and renames directories and files to match
 * the current templates and naming convention, working from each solution's
 * meta.json and .java file. Run it once after editing lib/problemReadmeTemplate.js
 * or lib/paths.js and every existing solution follows.
 *
 * A directory with no meta.json gets one rebuilt: the problem number and Java file
 * name from disk, title, topics and link from the rendered README, the difficulty
 * from the folder (the README shows it as a badge image), and firstSyncedAt from
 * the directory's earliest commit.
 *
 * Renames use `git mv` so history follows. Nothing is committed unless --commit
 * is given, and then only the paths this run touched, in one local commit. It
 * never pushes.
 *
 * Usage: node scripts/regenerate-all.js [repoRoot] [--commit "message" | --check]
 * --check runs the same detections without changing anything and exits 1 on any issue.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Makes git fail rather than wait on a credential prompt nobody can answer.
// Every git call here is local, so this is only a guard.
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

/** Tracked files under a repo-relative path, as the index has them right now. Empty for a path git has never seen. */
function trackedFilesUnder(repoRoot, relPath) {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--', relPath], { cwd: repoRoot, env: GIT_ENV, encoding: 'utf8' });
    return out.split('\0').filter(Boolean);
  } catch (e) {
    return [];
  }
}

/**
 * Moves a file or directory to its new name. A tracked path is moved with
 * `git mv`, so history and blame follow it. A path git has never tracked (a
 * solution added by hand and not committed yet) cannot be moved that way (git
 * refuses with "source directory is empty"), so it is a plain rename.
 *
 * `ledger` records what a `--commit` has to include afterwards. For a tracked
 * move that is both sides: `removed` collects the old paths (staged deletions
 * whose files are gone from disk) and `added` the new ones. A path that was
 * itself the result of an earlier move in the same run is only an intermediate
 * and drops out of both.
 */
function moveEntry(repoRoot, fromAbs, toAbs, ledger) {
  const fromRel = path.relative(repoRoot, fromAbs);
  const toRel = path.relative(repoRoot, toAbs);
  const tracked = trackedFilesUnder(repoRoot, fromRel);

  if (tracked.length > 0) {
    gitMv(repoRoot, fromRel, toRel);
    for (const oldPath of tracked) {
      const newPath = path.join(toRel, path.relative(fromRel, oldPath));
      if (!ledger.added.delete(oldPath)) ledger.removed.add(oldPath);
      ledger.added.add(newPath);
    }
  } else {
    fs.renameSync(fromAbs, toAbs);
  }

  // Anything already recorded as written under the old name now lives under the new one.
  ledger.touched.forEach((p, i) => {
    if (p === fromRel || p.startsWith(fromRel + path.sep)) ledger.touched[i] = toRel + p.slice(fromRel.length);
  });
}

/** Writes through a temporary file and a rename, so a crash mid-write cannot leave a truncated meta.json. */
function writeJsonAtomic(filePath, data) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmpPath, filePath);
}

/** Best-effort: the date of the earliest commit that added this directory, ISO 8601, or null if git has none. */
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
 * Reconstructs a meta.json for a directory that has none, using only what is on
 * disk. Returns the meta object (written to disk unless dryRun), or null when
 * there is not enough to do it safely (no .java file, or a directory name that
 * does not match the naming convention). The caller skips such a directory.
 *
 * With dryRun it builds the same object without writing it, so --check can still
 * judge naming and README staleness against it while making no writes.
 */
function backfillMeta({ repoRoot, dirPath, entryName, difficultyLabel, parseDirName, dryRun = false }) {
  const javaFile = fs.readdirSync(dirPath).find((f) => f.endsWith('.java'));
  if (!javaFile) return null;

  const parsed = parseDirName(entryName);
  if (!parsed) return null;
  const problemNumber = parsed.problemNumber;
  // slugFromDir is a last-resort fallback for the URL and titleSlug when the
  // README does not have them either. It is the bare number when the naming
  // convention has no slug (includeSlug: false).
  const slugFromDir = parsed.slug || String(problemNumber);

  const readmePath = path.join(dirPath, 'README.md');
  const content = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';
  // The header's LeetCode and Topics lines are list items ("- **LeetCode:** ...").
  // Their values are matched with [ \t]*(.*) and not \s*(.+), so an empty value
  // (a solution with no topics) stays empty instead of the match running across
  // the newline and returning the next line's text. generate-readme.js keeps its
  // own copy of these patterns in parseProblemReadmeFallback(), because the two
  // scripts are standalone; the copies must stay identical.
  const titleLine = content.match(/^#\s*LeetCode\s+\d+\.\s*(.+)$/m);
  const urlLine = content.match(/^- \*\*LeetCode:\*\*[ \t]*(.*)$/m);
  const topicsLine = content.match(/^- \*\*Topics:\*\*[ \t]*(.*)$/m);

  const url = (urlLine && urlLine[1].trim()) || `https://leetcode.com/problems/${slugFromDir}/`;
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
 * An independent structural scan of solutions/. It deliberately does not reuse
 * regenerateAll()'s per-directory loop or readProblems(): both iterate only the
 * known DIFFICULTY_DIRS, so a check built on them would be blind to anything
 * outside that structure. This walks solutions/ directly and flags:
 *
 *   - anything at the top level that is not a directory, or is a directory whose
 *     name is not one of DIFFICULTY_DIRS. Its contents, however valid they look,
 *     are invisible to every other check and to readProblems().
 *   - within a recognised difficulty folder, anything that is not a directory or
 *     whose name does not parse under the current naming convention. This
 *     overlaps the naming check in the main loop on purpose: it still reports the
 *     case where that loop never gets that far, for example because meta.json is
 *     malformed.
 *
 * Purely diagnostic, and it runs identically in both modes. It never renames,
 * moves or deletes anything, because there is no safe way to decide what a rogue
 * folder or stray file should become.
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
        `solutions/${topEntry.name} is not a directory. It is not part of any recognized difficulty folder ` +
          `(expected one of: ${expected}). Invisible to normal discovery/regeneration.`
      );
      continue;
    }
    if (!difficultyDirs.has(topEntry.name)) {
      found.push(
        `solutions/${topEntry.name}/ is not a recognized difficulty folder (expected one of: ${expected}). ` +
          'Its contents, if any, are invisible to normal discovery/regeneration.'
      );
      continue;
    }

    const diffPath = path.join(solutionsDir, topEntry.name);
    for (const probEntry of fs.readdirSync(diffPath, { withFileTypes: true })) {
      if (!probEntry.isDirectory()) {
        found.push(`solutions/${topEntry.name}/${probEntry.name} is not a directory. It is unrecognized and invisible to normal discovery/regeneration.`);
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

/**
 * Reports every problem number that is filed in more than one solution directory
 * (the same problem copied into two difficulty folders, say). Each directory is
 * individually valid, so nothing else notices, yet the root index counts one
 * solved problem twice. Identity is resolved the way findExistingSolutionDir()
 * does it: the number in the directory name when that parses, otherwise a
 * readable meta.json's problemNumber. Purely diagnostic, since there is no safe
 * way to decide which copy to keep.
 */
function findDuplicateProblemNumbers(repoRoot, lib) {
  const found = [];
  const solutionsDir = path.join(repoRoot, 'solutions');
  const byNumber = new Map();

  for (const diffFolder of lib.paths.DIFFICULTY_DIRS) {
    const diffPath = path.join(solutionsDir, diffFolder);
    if (!fs.existsSync(diffPath)) continue;
    for (const entry of fs.readdirSync(diffPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const parsed = lib.paths.parseDirName(entry.name);
      let number = parsed ? parsed.problemNumber : null;
      if (number === null) {
        try {
          const meta = JSON.parse(fs.readFileSync(path.join(diffPath, entry.name, 'meta.json'), 'utf8'));
          const fromMeta = Number(meta.problemNumber);
          if (Number.isFinite(fromMeta)) number = fromMeta;
        } catch (e) {
          /* no usable identity for this directory; the other checks report why */
        }
      }
      if (number === null) continue;
      if (!byNumber.has(number)) byNumber.set(number, []);
      byNumber.get(number).push(`solutions/${diffFolder}/${entry.name}`);
    }
  }

  for (const [number, dirs] of [...byNumber].sort((a, b) => a[0] - b[0])) {
    if (dirs.length > 1) {
      found.push(
        `Problem number ${number} is filed in more than one solution directory (${dirs.join(', ')}). The root ` +
          'index counts it once per directory. Not fixed automatically: keep one and remove the other by hand.'
      );
    }
  }
  return found;
}

/**
 * Re-renders and renames every solution under repoRoot. With `options.dryRun` it
 * only reports. Detection and the fix are separate steps: every check below is
 * the same call in both modes (parseDirName, problemNumberMismatch,
 * solutionDirName, javaFileName, readProblems) and dryRun only gates the write
 * that follows it, so there is one definition of "inconsistent" for both.
 *
 * Returns { changed, touchedPaths, removedPaths, issues }. The first three list
 * what this run wrote or moved and are empty in dryRun: `touchedPaths` is every
 * path that now holds new content, and `removedPaths` the old paths of any
 * tracked `git mv`, which a commit must include or the deletion half of the move
 * is left behind. `issues` lists what the run did not fix. In write mode that is
 * what it refuses to repair on its own (a problem-number mismatch, a missing .java
 * file, a rename onto an existing directory, a duplicate number, an entry outside
 * the naming convention) plus the warnings generate-readme.js collects. In dryRun
 * it is every drift found.
 */
function regenerateAll(repoRoot, options = {}) {
  const dryRun = !!options.dryRun;
  repoRoot = path.resolve(repoRoot);
  const lib = loadLib(repoRoot);
  const solutionsDir = path.join(repoRoot, 'solutions');
  const changed = [];
  const touchedPaths = [];
  const issues = [];
  const moves = { removed: new Set(), added: new Set(), touched: touchedPaths };

  // No early return when solutions/ does not exist: the root README is still
  // compared below, because deleting the last solution leaves a stale badge and
  // index rows behind that only a comparison can notice. The scans and the loop
  // simply find nothing to do without the directory.
  issues.push(...findOrphanedEntries(repoRoot, lib));

  const duplicates = findDuplicateProblemNumbers(repoRoot, lib);
  for (const msg of duplicates) {
    if (!dryRun) console.warn(msg);
    issues.push(msg);
  }

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
          // A hand-corrupted meta.json is rare and important enough that write
          // mode fails loudly rather than guessing. Check mode reports it and
          // keeps going, which is what a check meant to run unattended needs.
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

      // meta.json can be valid and still wrong, so check its problemNumber against
      // the number in this directory's current name before trusting it to compute
      // a new name. Unchecked, the mismatch would be baked in: the directory would
      // be renamed to match the wrong number, destroying the one piece of evidence
      // (the original name) that the record was wrong. A meta.json backfilled just
      // above cannot trigger this, because its number comes from the directory name.
      const mismatch = lib.paths.problemNumberMismatch(entry.name, meta);
      if (mismatch) {
        const msg =
          `Skipping solutions/${currentRelDirName}: meta.json says problemNumber ${mismatch.metaNumber} but the ` +
          `directory name encodes ${mismatch.nameNumber} (these disagree). Not renaming or otherwise ` +
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

      // The desired names under the current naming convention. If meta.json's
      // difficulty differs from the folder the directory is in, the desired
      // directory name is under another difficulty folder, so the move also
      // covers a reclassification.
      const desiredRelDirName = lib.paths.solutionDirName(meta);
      const desiredJavaFileName = lib.paths.javaFileName(meta);

      // In dryRun nothing moves, so these stay at the real on-disk location and
      // every later check in this iteration (the .java rename, the meta.json
      // field, the per-problem README) reads from where the files actually are,
      // not from the hypothetical new location.
      let dirPath = currentDirPath;
      let relDirNameNow = currentRelDirName;

      if (desiredRelDirName !== currentRelDirName && fs.existsSync(path.join(solutionsDir, desiredRelDirName))) {
        // Moving onto a directory that already exists would nest this one
        // inside it (git mv does exactly that), so leave both alone.
        const msg =
          `Skipping solutions/${currentRelDirName}: it should be named solutions/${desiredRelDirName}, but that ` +
          'directory already exists. Not moving one onto the other; resolve the duplicate by hand first.';
        console.warn(msg);
        issues.push(msg);
        continue;
      }

      if (desiredRelDirName !== currentRelDirName) {
        if (dryRun) {
          issues.push(
            `solutions/${currentRelDirName}: directory name doesn't match the current naming convention ` +
              `(would rename to solutions/${desiredRelDirName}).`
          );
        } else {
          const desiredDirPath = path.join(solutionsDir, desiredRelDirName);
          fs.mkdirSync(path.dirname(desiredDirPath), { recursive: true }); // e.g. medium/ may not exist yet
          moveEntry(repoRoot, currentDirPath, desiredDirPath, moves);
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
          moveEntry(repoRoot, path.join(dirPath, javaFileCurrent), path.join(dirPath, desiredJavaFileName), moves);
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

      // `code: javaCode` is the exact string read from the .java file above, the
      // same text the Javadoc fields were parsed from, so the embedded source is
      // derived from precisely what is on disk.
      const readme = lib.template.buildProblemReadme({ ...meta, approach, time, space, code: javaCode });
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

  // The root index comes from meta.json (falling back to the rendered README for
  // anything that could not be backfilled above), so refresh it too.
  // collectWarnings routes readProblems()'s own findings (difficulty and
  // problem-number mismatches, an unreadable meta.json) into the same `issues`
  // list. The console warnings it prints are unaffected.
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

  return {
    changed,
    touchedPaths: [...new Set([...touchedPaths, ...moves.added])],
    removedPaths: [...moves.removed],
    issues,
  };
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
    // Read-only by construction: dryRun skips every write and rename that
    // follows the same detection calls the normal path uses (see regenerateAll()).
    const { issues } = regenerateAll(repoRoot, { dryRun: true });

    if (!issues.length) {
      console.log('Consistency check passed: no issues found. Nothing was changed (this mode never writes).');
      process.exit(0);
    } else {
      console.log(`Consistency check found ${issues.length} issue(s) (nothing was changed because this mode never writes):`);
      issues.forEach((issue) => console.log('  - ' + issue));
      console.log('\nRun `node scripts/regenerate-all.js` (optionally with --commit) to fix what can be fixed automatically.');
      console.log('Anything above that was skipped rather than auto-fixed needs a manual repair first. See its own message for what to fix.');
      process.exit(1);
    }
  }

  const { changed, touchedPaths, removedPaths } = regenerateAll(repoRoot);

  if (!changed.length) {
    console.log('Nothing changed: everything already matches the current templates/conventions.');
  } else {
    console.log(`Updated ${changed.length} item(s):`);
    changed.forEach((c) => console.log('  - ' + c));

    if (commitMessage) {
      // Scoped to exactly what this run touched, never `git add -A`. The commit
      // itself takes an explicit pathspec, so neither an unrelated uncommitted
      // change in the working tree nor something the owner already staged rides
      // along in it.
      const commitPaths = [...new Set([...touchedPaths, ...removedPaths])];
      if (commitPaths.length === 0) {
        console.log('\nNothing to commit: the changes above are not tracked by git yet (stage them yourself when ready).');
      } else {
        execFileSync('git', ['add', '--', ...touchedPaths], { cwd: path.resolve(repoRoot), env: GIT_ENV });
        execFileSync('git', ['commit', '-m', commitMessage, '--', ...commitPaths], { cwd: path.resolve(repoRoot), env: GIT_ENV });
        console.log(`\nCommitted locally as: ${commitMessage}\nReview with \`git show\`, then \`git push\` when ready.`);
      }
    } else {
      console.log('\nNothing committed yet. Review with `git status` / `git diff`, then commit and push yourself.');
      console.log('(Or re-run with --commit "your message" to have this script make that commit for you. It will never push.)');
    }
  }
}
