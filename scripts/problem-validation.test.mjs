import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { validateProblems } from "./problem-validation.mjs";

const fixtures = JSON.parse(await readFile(new URL("../data/problems.json", import.meta.url), "utf8"));

test("all checked-in problem fixtures satisfy the versioned content contract", () => {
  assert.deepEqual(validateProblems(fixtures), []);
});

test("validator catches duplicate slugs, duplicate case IDs, bad argument types, and missing references", () => {
  const invalid = structuredClone(fixtures.slice(0, 1));
  invalid.push(structuredClone(invalid[0]));
  invalid[0].hiddenTestCases[0].id = invalid[0].examples[0].id;
  invalid[0].examples[0].args[0] = 42;
  delete invalid[0].referenceSolution;

  const errors = validateProblems(invalid).join("\n");
  assert.match(errors, /slug is duplicated/);
  assert.match(errors, /duplicated across visible and hidden cases/);
  assert.match(errors, /does not match C\+\+ type/);
  assert.match(errors, /referenceSolution is required/);
});
