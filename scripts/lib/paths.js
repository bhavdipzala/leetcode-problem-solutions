/**
 * The naming policy: the one module that decides how solutions are laid out on
 * disk. Anything that builds or parses a solution directory or file name goes
 * through the functions exported here, and nothing else should hard-code a
 * prefix, padding width, separator or regex of its own.
 *
 * The convention is the small data object NAMING_CONVENTION below, not a format
 * string, which would be harder to read, test and change safely. Its current values
 * produce solutions/{difficulty}/LC-{4-digit number}-{slug}/, for example
 * solutions/medium/LC-0015-3sum/. Grouping by difficulty and zero-padding the
 * number keep a plain alphabetical listing, GitHub's included, sorted sensibly.
 *
 * To change the convention, edit those fields (or solutionDirName() and
 * javaFileName() for something they cannot express) and run
 * `node scripts/regenerate-all.js`. An edit only changes the desired name from
 * then on; regenerate-all.js is what walks the existing solutions and `git mv`s
 * the ones that have drifted. A submission synced after the edit already gets
 * the new name.
 */
const fs = require('fs');
const path = require('path');

/**
 * The naming policy as data. The functions below read these fields on every
 * call, never a value captured earlier, so an edit takes effect on the next call
 * with no other file needing to know.
 *
 *   prefix       - literal text before the problem number, e.g. "LC-".
 *   paddingWidth - zero-pad the problem number to at least this many digits
 *                  (0 = no padding).
 *   separator    - literal text between the padded number and the slug. Unused
 *                  when includeSlug is false.
 *   includeSlug  - whether the name includes the slug, or is just the padded
 *                  number (e.g. "LC-0001").
 *
 * parseDirName() recognises only the convention configured here. It is not a
 * detector for earlier formats.
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

/** Escapes a literal string for use inside a RegExp. The prefix and separator are configuration and may contain regex metacharacters. */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The segment a solution's own directory is named, without the difficulty
 * folder: "LC-0001-two-sum", not "easy/LC-0001-two-sum". solutionDirName() joins
 * it with the folder, and parseDirName() is its inverse.
 */
function baseDirName(meta) {
  const numberPart = `${NAMING_CONVENTION.prefix}${paddedNumber(meta.problemNumber)}`;
  if (!NAMING_CONVENTION.includeSlug) return numberPart;
  const slug = slugify(meta.titleSlug || meta.title);
  return [numberPart, slug].join(NAMING_CONVENTION.separator);
}

/**
 * A RegExp matching what baseDirName() produces under the current
 * NAMING_CONVENTION. It is built on every call, so a change to the convention
 * needs no separate step to recompile the pattern.
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
 * The .java file name: the slug plus ".java", using the same slug as the
 * directory name. It does not depend on the prefix, padding or separator, and it
 * is not derived from a PascalCase class name. It is a separate function so that
 * it and solutionDirName() can be changed independently.
 */
function javaFileName(meta) {
  return `${slugify(meta.titleSlug || meta.title)}.java`;
}

/**
 * Parses one directory-name segment (e.g. "LC-0001-two-sum", not a
 * solutions/-relative path) against the current naming convention. Returns
 * { problemNumber, slug } on a match (slug is null when includeSlug is false),
 * or null when the name does not match, rather than throwing.
 *
 * This is the one place that recovers an identity from a name. It is used by
 * problemNumberMismatch(), findExistingSolutionDir() and the scripts that need a
 * number from a directory name (regenerate-all.js, generate-readme.js).
 *
 * Only the configured convention is recognised. A directory that predates a
 * change to the prefix, separator or includeSlug does not parse until
 * regenerate-all.js has renamed it, which is why meta.json stays the identity
 * source when a name does not parse. The number matches any count of digits, so
 * changing paddingWidth alone leaves old names readable.
 */
function parseDirName(dirName) {
  const m = String(dirName == null ? '' : dirName).match(baseDirNameRegex());
  if (!m) return null;
  const problemNumber = Number(m[1]);
  if (!Number.isFinite(problemNumber)) return null;
  return { problemNumber, slug: NAMING_CONVENTION.includeSlug ? m[2] : null };
}

/**
 * Compares the problem number in a directory's name (parsed under the current
 * convention) with meta.json's problemNumber. The name carries the same identity
 * redundantly, which matters because meta.json can be valid JSON and still wrong
 * (typically a hand-edit typo) with nothing else to catch it.
 *
 * Returns { nameNumber, metaNumber } on a real, comparable mismatch. Returns null
 * when they agree or there is not enough to compare (the name does not match the
 * convention, or meta has no usable problemNumber). It never throws, so it is
 * safe to call speculatively.
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
 * Finds the existing directory for a problem number, or null if the problem has
 * never been synced. The result is relative to solutions/, e.g.
 * "medium/LC-0015-3sum".
 *
 * Every folder directly under solutions/ is searched (normally easy, medium and
 * hard), not only the one the current submission reports, so a problem is never
 * duplicated by a resubmission, a change of difficulty or a missing meta.json.
 *
 * Within a directory the number in its name (via parseDirName) wins over
 * meta.json's problemNumber, and meta.json is the fallback for a directory whose
 * name does not follow the convention (a hand-named one, say). When the two
 * disagree a warning is printed and nothing is repaired here. Trusting the name
 * stops a valid but wrong problemNumber in meta.json from hiding the real
 * directory from a genuine resubmission, which would create a duplicate, and
 * from merging a new problem into someone else's mismatched directory.
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
          // A corrupt meta.json falls through to name-based matching below
          // rather than giving up on this directory.
        }
      }

      if (metaReadable) {
        const mismatch = problemNumberMismatch(probEntry.name, meta);
        if (mismatch) {
          console.warn(
            `solutions/${diffName}/${probEntry.name}: meta.json says problemNumber ${mismatch.metaNumber} but ` +
              `the directory name encodes ${mismatch.nameNumber} (these disagree). Using the directory name as ` +
              "the source of truth for discovery (meta.json's content is left untouched); please repair this by " +
              "hand: fix meta.json's problemNumber, or rename the directory, so both agree."
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
