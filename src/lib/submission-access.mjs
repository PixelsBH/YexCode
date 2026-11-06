export function ownedSubmissionFilter(userId, scope = {}) {
  if (userId === null || userId === undefined) {
    throw new TypeError("An authenticated database user ID is required.");
  }

  return {
    userId,
    ...(scope.submissionId !== undefined ? { _id: scope.submissionId } : {}),
    ...(scope.judgeSubmissionId !== undefined ? { judgeSubmissionId: scope.judgeSubmissionId } : {}),
    ...(scope.problemSlug !== undefined ? { problemSlug: scope.problemSlug } : {}),
  };
}
