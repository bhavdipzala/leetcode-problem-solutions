/**
 * ===========================================================================
 * NAMING CONVENTION — the one authoritative naming-policy module (F7)
 * ===========================================================================
 * This is the one place that decides how solutions are laid out on disk.
 * Every other file that needs to build, parse, or reason about a solution
 * directory/file name goes through the functions exported here — nothing
 * else in the project should hard-code a prefix, padding width, separator,
 * or its own regex for this.
 *
 * The convention is described by NAMING_CONVENTION below, not by a
 * template string — a handful of explicit fields (prefix, zero-padding
 * width, separator, whether the slug is included) is enough for the
 * flexibility this project actually needs, and is easier to read, test,
 * and safely change than a `{number:04d}`-style format-string parser would
 * be.
 *
 * Today's values produce:
 *
 *   solutions/{difficulty}/LC-{4-digit problem number}-{slug}/
 *
 * e.g. solutions/easy/LC-0001-two-sum/, solutions/medium/LC-0015-3sum/.
 * Grouping by difficulty, and zero-padding the number, both exist for the
 * same reason: so the repo sorts sensibly with nothing more than a plain
 * alphabetical file browser (GitHub's own directory view included) — no
 * padding would put LC10 before LC2; no grouping would interleave
 * difficulties in a way the generated tables already sort past but a
 * human clicking through solutions/ on github.com would still see.
 *
 * ---------------------------------------------------------------------
 * TO CHANGE THE NAMING CONVENTION:
 * ---------------------------------------------------------------------
 *   1. Edit the NAMING_CONVENTION fields below (or, for a change deeper
 *      than these four fields allow — e.g. a from-scratch redesign of
 *      the .java file name — edit solutionDirName()/javaFileName()
 *      directly; they're small on purpose).
 *   2. Run:  node scripts/regenerate-all.js
 *
 * Changing the config alone does NOT retroactively rename anything by
 * itself — it only changes what solutionDirName()/javaFileName() compute
 * as the *desired* name from here on. `regenerate-all.js` is the explicit
 * step that walks every existing solution, recomputes its desired name
 * under the new convention, and `git mv`s anything that's drifted — so
 * changing e.g. the padding width brings the *entire* existing repo into
 * compliance on the next run, not just solutions touched for other
 * reasons. A submission synced after the config change but before that
 * run already gets the new convention immediately (live sync always
 * computes the *current* desired name); only pre-existing directories are
 * waiting on that one `regenerate-all.js` pass.
 *
 * Nothing here needs to change for a normal day-to-day sync — only when
 * you deliberately want to restructure the repo.
 * ---------------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');

/**
 * The naming policy, as data. Every build/parse function below reads
 * these fields live (never a value captured at some earlier time), so
 * editing them — or, in a test, mutating this object directly — takes
 * effect on the very next call, with no other file needing to know.
 *
 *   prefix       - literal text before the problem number, e.g. "LC-".
 *   paddingWidth - zero-pad the problem number to at least this many
 *                  digits (0 = no padding).
 *   separator    - literal text between the padded number and the slug.
 *                  Unused when includeSlug is false.
 *   includeSlug  - whether the directory/parse name includes the slug at
 *                  all, or is just the padded number (e.g. "LC-0001").
 *
 * This repository has only ever used one real convention (the defaults
 * below). This config makes that convention explicit and changeable in
 * one place — it is not a general historical-format detector, and
 * deliberately doesn't try to be: see parseDirName().
 */
const NAMING_CONVENTION = {
  prefix: 'LC-',
  paddingWidth: 4,
  separator: '-',
  includeSlug: true,
};

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function difficultyFolder(difficulty) {
  return slugify(difficulty) || 'unknown';
}

function paddedNumber(problemNumber) {
  return String(problemNumber).padStart(NAMING_CONVENTION.paddingWidth, '0');
}

/** Escapes a literal string for safe interpolation into a RegExp — prefix/separator are configuration, not guaranteed to be regex-safe as typed. */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The single segment a solution's own directory is named (i.e. NOT
 * including the difficulty folder it sits under) — "LC-0001-two-sum",
 * not "easy/LC-0001-two-sum". solutionDirName() below joins this with
 * the difficulty folder; parseDirName() is its inverse.
 */
function baseDirName(meta) {
  const numberPart = `${NAMING_CONVENTION.prefix}${paddedNumber(meta.problemNumber)}`;
  if (!NAMING_CONVENTION.includeSlug) return numberPart;
  const slug = slugify(meta.titleSlug || meta.title);
  return [numberPart, slug].join(NAMING_CONVENTION.separator);
}

/**
 * Builds a RegExp matching exactly what baseDirName() currently produces,
 * for the CURRENT NAMING_CONVENTION — read live on every call, same as
 * everything else here, so a config change takes effect immediately with
 * no separate "recompile the pattern" step anywhere.
 */
function baseDirNameRegex() {
  const prefix = escapeRegExp(NAMING_CONVENTION.prefix);
  if (!NAMING_CONVENTION.includeSlug) {
    return new RegExp(`^${prefix}(\\d+)$`);
  }
  const sep = escapeRegExp(NAMING_CONVENTION.separator);
  return new RegExp(`^${prefix}(\\d+)${sep}(.+)$`);
}

/** Relative to solutions/, e.g. "easy/LC-0001-two-sum". */
function solutionDirName(meta) {
  return path.join(difficultyFolder(meta.difficulty), baseDirName(meta));
}

/**
 * The current .java file-naming logic is its own thing, independent of
 * NAMING_CONVENTION's prefix/padding/separator — it has always just been
 * the kebab-case slug plus ".java", reusing the same slug the directory
 * name uses. (Some conventions elsewhere derive a PascalCase Java class
 * name from the title instead; this repository never has — verified
 * against the real prior implementation, not assumed.) Kept as its own
 * function, alongside solutionDirName(), so both remain independently
 * overridable without touching the other, exactly as before.
 */
function javaFileName(meta) {
  return `${slugify(meta.titleSlug || meta.title)}.java`;
}

/**
 * Parses a single directory-name segment (e.g. "LC-0001-two-sum" — NOT a
 * solutions/-relative path) against the CURRENT naming convention.
 * Returns { problemNumber, slug } on a match — slug is null when
 * includeSlug is false — or null when the name doesn't match at all.
 *
 * This is the one place that recovers identity from a name string;
 * problemNumberMismatch() and findExistingSolutionDir() below, and every
 * external consumer that used to run its own regex against a directory
 * name (regenerate-all.js's meta.json backfill, generate-readme.js's
 * README-fallback recovery), now call this instead.
 *
 * By design this only recognizes the one real convention currently
 * configured above, plus a non-match returns null rather than throwing —
 * it is not a general-purpose detector for conventions this repository
 * has never actually used (see the module doc comment). A directory that
 * predates a convention change and hasn't been through
 * `regenerate-all.js` yet simply won't parse until that run renames it;
 * meta.json (when present and readable) remains the primary identity
 * source specifically so that gap is never load-bearing for anything but
 * the fallback paths this function exists for.
 */
function parseDirName(dirName) {
  const m = String(dirName == null ? '' : dirName).match(baseDirNameRegex());
  if (!m) return null;
  const problemNumber = Number(m[1]);
  if (!Number.isFinite(problemNumber)) return null;
  return { problemNumber, slug: NAMING_CONVENTION.includeSlug ? m[2] : null };
}

/**
 * Compares the problem number encoded in a directory's own name (per the
 * current naming convention, via parseDirName) against meta.json's
 * problemNumber, when both are available and parseable. meta.json is the
 * canonical data record, but the directory name carries the same
 * identity redundantly — cheap insurance, since meta.json can be
 * syntactically valid and simply wrong (most often a hand-edit typo)
 * with nothing else to catch it. (F14)
 *
 * Returns { nameNumber, metaNumber } on a genuine, comparable mismatch,
 * or null when they agree or there isn't enough information to compare
 * (name doesn't match the convention, or meta has no usable
 * problemNumber) — never throws, safe to call speculatively.
 */
function problemNumberMismatch(dirName, meta) {
  const parsed = parseDirName(dirName);
  if (!parsed) return null;
  const nameNumber = parsed.problemNumber;
  const metaNumber = meta ? Number(meta.problemNumber) : NaN;
  if (!Number.isFinite(metaNumber)) return null;
  if (nameNumber === metaNumber) return null;
  return { nameNumber, metaNumber };
}

/**
 * Finds the existing solution directory for a given problem number,
 * searching across all three difficulty folders — never just the one
 * the current submission happens to report — so a problem can never be
 * duplicated, whether it's being resubmitted unchanged, reclassified to
 * a different difficulty, or predates meta.json entirely. Returns a path
 * relative to solutions/ (e.g. "medium/LC-0015-3sum"), or null if this
 * problem has genuinely never been synced before.
 *
 * For each directory found under any solutions/{difficulty}/, identity is
 * resolved using whichever signal is available, with the directory's own
 * name preferred over meta.json when both are present (F14):
 *   - the number in the directory name (via parseDirName), when the name
 *     matches the naming convention — the primary signal, since it's
 *     redundant, harder-to-corrupt identity information.
 *   - otherwise, meta.json's problemNumber — for a solution whose
 *     directory doesn't follow the convention (e.g. added or hand-named
 *     outside the normal sync flow) but does have metadata.
 *
 * When a directory's name and its own meta.json disagree on the problem
 * number, that's surfaced as a warning (see problemNumberMismatch) but
 * never auto-repaired here — meta.json remains the canonical data record
 * once a directory has been identified. Preferring the name for identity
 * resolution is what keeps a syntactically-valid-but-wrong problemNumber
 * from either (a) hiding the real directory from a genuine resubmission
 * — the original F14 reproduction, which created a duplicate — or (b)
 * the reverse: a genuine new submission for the number meta.json wrongly
 * claims getting silently merged into someone else's mismatched
 * directory instead.
 */
function findExistingSolutionDir(repoRoot, problemNumber) {
  const solutionsDir = path.join(repoRoot, 'solutions');
  if (!fs.existsSync(solutionsDir)) return null;

  const difficultyDirs = fs
    .readdirSync(solutionsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const target = Number(problemNumber);

  for (const diffName of difficultyDirs) {
    const diffPath = path.join(solutionsDir, diffName);
    const problemDirs = fs.readdirSync(diffPath, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const probEntry of problemDirs) {
      const metaPath = path.join(diffPath, probEntry.name, 'meta.json');

      let meta = null;
      let metaReadable = false;
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          metaReadable = true;
        } catch (e) {
          // Corrupt meta.json — fall through to name-based matching below
          // as a last resort rather than giving up on this directory.
        }
      }

      if (metaReadable) {
        const mismatch = problemNumberMismatch(probEntry.name, meta);
        if (mismatch) {
          console.warn(
            `solutions/${diffName}/${probEntry.name}: meta.json says problemNumber ${mismatch.metaNumber} but ` +
              `the directory name encodes ${mismatch.nameNumber} — these disagree. Using the directory name as ` +
              "the source of truth for discovery (meta.json's content is left untouched); please repair this by " +
              "hand — fix meta.json's problemNumber, or rename the directory, so both agree."
          );
        }
      }

      const parsedName = parseDirName(probEntry.name);
      const nameNumber = parsedName ? parsedName.problemNumber : null;
      const candidateNumber = nameNumber !== null ? nameNumber : metaReadable ? Number(meta.problemNumber) : null;

      if (candidateNumber !== null && Number.isFinite(candidateNumber) && candidateNumber === target) {
        return path.join(diffName, probEntry.name);
      }
    }
  }

  return null;
}

const DIFFICULTY_DIRS = ['easy', 'medium', 'hard'];

module.exports = {
  NAMING_CONVENTION,
  slugify,
  difficultyFolder,
  paddedNumber,
  solutionDirName,
  javaFileName,
  parseDirName,
  findExistingSolutionDir,
  problemNumberMismatch,
  DIFFICULTY_DIRS,
};
