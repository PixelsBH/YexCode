import assert from "node:assert/strict";
import test from "node:test";

import { ownedSubmissionFilter } from "./submission-access.mjs";

test("submission query filters always require the authenticated database user", () => {
  assert.throws(() => ownedSubmissionFilter(undefined), /authenticated database user ID/);
  assert.throws(() => ownedSubmissionFilter(null), /authenticated database user ID/);
});

test("history filters are scoped to the user and optional problem slug", () => {
  const userId = "user-object-id";
  assert.deepEqual(ownedSubmissionFilter(userId, { problemSlug: "two-sum" }), {
    userId,
    problemSlug: "two-sum",
  });
});

test("detail filters combine the submission ID with the authenticated owner", () => {
  const userId = "user-object-id";
  assert.deepEqual(ownedSubmissionFilter(userId, { submissionId: "submission-object-id" }), {
    userId,
    _id: "submission-object-id",
  });
});

test("judge correlation lookups also require the authenticated owner", () => {
  const userId = "user-object-id";
  assert.deepEqual(ownedSubmissionFilter(userId, { judgeSubmissionId: "judge-id" }), {
    userId,
    judgeSubmissionId: "judge-id",
  });
});
