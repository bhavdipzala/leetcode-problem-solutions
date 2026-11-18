/**
 * Builds the commit message for each synced submission. The sync service loads
 * this file afresh on every submission, so an edit applies to the next sync with
 * no restart.
 *
 * `meta` has the same shape as a solution's meta.json: submissionId,
 * problemNumber, title, titleSlug, difficulty, topics, url, language,
 * javaFileName, firstSyncedAt, lastSyncedAt.
 *
 * An edit only affects commits made afterwards. Past messages cannot be
 * regenerated the way README files can, because a message is part of its commit:
 * changing one means rewriting that commit and every commit after it (new SHAs
 * and a force-push). Nothing in scripts/ does that, and regenerate-all.js never
 * touches commit messages.
 */
function buildCommitMessage(meta) {
  return `solve: LeetCode ${meta.problemNumber} - ${meta.title} [${meta.difficulty}]`;
}

module.exports = { buildCommitMessage };
