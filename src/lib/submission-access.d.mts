export type OwnedSubmissionScope = {
  submissionId?: string;
  judgeSubmissionId?: string;
  problemSlug?: string;
};

export function ownedSubmissionFilter(
  userId: unknown,
  scope?: OwnedSubmissionScope
): Record<string, unknown>;
