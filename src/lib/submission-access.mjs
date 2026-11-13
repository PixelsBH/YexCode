const OPAQUE_SUBMISSION_ID = /^sub_[A-Za-z0-9_-]{43}$/;

export function isOpaqueSubmissionId(value) {
  return typeof value === "string" && OPAQUE_SUBMISSION_ID.test(value);
}

export function isSubmissionPollingIdAllowed(value, operation) {
  if (operation === "submit") return true;
  if (operation !== "run" && operation !== "benchmark") return false;
  return isOpaqueSubmissionId(value);
}

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
