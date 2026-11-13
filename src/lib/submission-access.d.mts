export type OwnedSubmissionScope = {
  submissionId?: string;
  judgeSubmissionId?: string;
  problemSlug?: string;
};

export function isOpaqueSubmissionId(value: unknown): value is string;

export function isSubmissionPollingIdAllowed(value: unknown, operation: string): boolean;

export function ownedSubmissionFilter(
  userId: unknown,
  scope?: OwnedSubmissionScope
): Record<string, unknown>;
