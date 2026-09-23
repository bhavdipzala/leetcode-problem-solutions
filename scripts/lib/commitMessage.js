/**
 * ===========================================================================
 * MASTER COMMIT MESSAGE TEMPLATE
 * ===========================================================================
 * Decides the commit message used for every future accepted-submission
 * sync. Lives in your repo, loaded fresh by the service on every
 * submission — edit it any time, no restart needed, same as the other
 * templates in this folder.
 *
 * `meta` has the same shape as solutions/{dir}/meta.json: submissionId,
 * problemNumber, title, titleSlug, difficulty, topics, url, language,
 * javaFileName, firstSyncedAt, lastSyncedAt.
 *
 * IMPORTANT — this only affects commits made AFTER you change it. Unlike
 * the README template and naming convention, past commit messages can't
 * be safely "regenerated." A commit's message is part of the commit
 * itself; changing a historical one means rewriting that commit and
 * every commit after it (new SHAs, a force-push, broken clones/forks).
 * That's a fundamentally different, much riskier operation than the
 * file-content regeneration scripts/regenerate-all.js does — which only
 * ever adds a new commit on top. This toolkit deliberately never rewrites
 * history automatically, and regenerate-all.js does not touch commit
 * messages at all.
 */
function buildCommitMessage(meta) {
  return `solve: LeetCode ${meta.problemNumber} - ${meta.title} [${meta.difficulty}]`;
}

module.exports = { buildCommitMessage };
