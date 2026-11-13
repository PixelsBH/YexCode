import assert from "node:assert/strict";
import test from "node:test";

import { isOpaqueSubmissionId, isSubmissionPollingIdAllowed, ownedSubmissionFilter } from "./submission-access.mjs";

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

test("anonymous result IDs must be opaque capability IDs, not legacy timestamps", () => {
  assert.equal(isOpaqueSubmissionId(`sub_${"a".repeat(43)}`), true);
  assert.equal(isOpaqueSubmissionId("1794555830832000000"), false);
  assert.equal(isOpaqueSubmissionId("sub_short"), false);
  assert.equal(isOpaqueSubmissionId(null), false);
});

test("anonymous run and benchmark polls reject legacy IDs but submit history can look them up", () => {
  const capabilityId = `sub_${"a".repeat(43)}`;
  const legacyId = "1794555830832000000";

  assert.equal(isSubmissionPollingIdAllowed(capabilityId, "run"), true);
  assert.equal(isSubmissionPollingIdAllowed(capabilityId, "benchmark"), true);
  assert.equal(isSubmissionPollingIdAllowed(legacyId, "run"), false);
  assert.equal(isSubmissionPollingIdAllowed(legacyId, "benchmark"), false);
  assert.equal(isSubmissionPollingIdAllowed(legacyId, "submit"), true);
  assert.equal(isSubmissionPollingIdAllowed(capabilityId, "unknown"), false);
});
