import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    let value = match[2];
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadLocalEnv();

const dryRun = process.argv.includes("--dry-run");
const slugOptionIndex = process.argv.indexOf("--slug");
const slugFilter = slugOptionIndex >= 0 ? process.argv[slugOptionIndex + 1] : undefined;
if (slugOptionIndex >= 0 && !slugFilter) {
  throw new Error("--slug requires a problem slug.");
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not configured. Add it to .env.local or the environment.");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeTestCase(testCase, slug, field, index) {
  if (!isRecord(testCase)) {
    throw new Error(`${slug}: ${field}[${index}] must be an object.`);
  }

  let { args, expected } = testCase;
  if (!Array.isArray(args) || !Object.hasOwn(testCase, "expected")) {
    if (typeof testCase.input !== "string" || typeof testCase.expectedOutput !== "string") {
      throw new Error(`${slug}: ${field}[${index}] is not a supported JSON function test case.`);
    }

    try {
      args = JSON.parse(testCase.input);
      expected = JSON.parse(testCase.expectedOutput);
    } catch {
      throw new Error(`${slug}: ${field}[${index}] has non-JSON legacy input/output; migrate it manually.`);
    }
  }

  if (!Array.isArray(args) || !Object.hasOwn(testCase, "expected") && expected === undefined) {
    throw new Error(`${slug}: ${field}[${index}] must have an args array and expected JSON value.`);
  }

  return {
    id: Number.isSafeInteger(testCase.id) && testCase.id > 0 ? testCase.id : index + 1,
    args,
    expected,
  };
}

function caseValue(testCase) {
  return { args: testCase.args, expected: testCase.expected };
}

function formatLegacyOutput(value) {
  if (Array.isArray(value) && value.every((item) => ["string", "number", "boolean"].includes(typeof item))) {
    return value.map(String).join(" ");
  }
  if (typeof value === "string") return value;
  if (["number", "boolean"].includes(typeof value)) return String(value);
  return JSON.stringify(value);
}

function migrateProblem(problem) {
  const slug = typeof problem.slug === "string" ? problem.slug : "<missing-slug>";
  const functionSpec = problem.function;
  if (
    !isRecord(functionSpec) ||
    typeof functionSpec.name !== "string" ||
    typeof functionSpec.returnType !== "string" ||
    !Array.isArray(functionSpec.params) ||
    functionSpec.params.some((param) => !isRecord(param) || typeof param.name !== "string" || typeof param.type !== "string")
  ) {
    throw new Error(`${slug}: missing supported C++ function metadata.`);
  }
  if (typeof problem.templates?.cpp !== "string" || problem.templates.cpp.length === 0) {
    throw new Error(`${slug}: missing C++ Function Mode template.`);
  }
  if (typeof problem.title !== "string" || typeof problem.description !== "string" || !["Easy", "Medium", "Hard"].includes(problem.difficulty)) {
    throw new Error(`${slug}: title, description, or difficulty is invalid.`);
  }

  const rawExamples = Array.isArray(problem.examples) ? problem.examples : [];
  const legacyStructuredCases = Array.isArray(problem.testCasesJson) ? problem.testCasesJson : [];
  if (legacyStructuredCases.length > 0 && Array.isArray(problem.testCases) && problem.testCases.length > 0) {
    if (problem.testCases.length !== legacyStructuredCases.length) {
      throw new Error(`${slug}: legacy text and structured suites have different test counts; migrate manually.`);
    }
    const expectedCounts = new Map();
    for (const testCase of legacyStructuredCases) {
      const normalizedOutput = formatLegacyOutput(testCase.expected).trim().replace(/\\s+/g, " ");
      expectedCounts.set(normalizedOutput, (expectedCounts.get(normalizedOutput) || 0) + 1);
    }
    for (const testCase of problem.testCases) {
      if (!isRecord(testCase) || typeof testCase.expectedOutput !== "string") {
        throw new Error(`${slug}: legacy text suite has an unsupported expected output; migrate manually.`);
      }
      const normalizedOutput = testCase.expectedOutput.trim().replace(/\\s+/g, " ");
      const remaining = expectedCounts.get(normalizedOutput) || 0;
      if (remaining === 0) throw new Error(`${slug}: legacy text and structured suites disagree; migrate manually.`);
      expectedCounts.set(normalizedOutput, remaining - 1);
    }
  }
  let examples;
  if (rawExamples.every((testCase) => isRecord(testCase) && Array.isArray(testCase.args) && Object.hasOwn(testCase, "expected"))) {
    examples = rawExamples.map((testCase, index) => ({
      ...normalizeTestCase(testCase, slug, "examples", index),
      ...(typeof testCase.explanation === "string" ? { explanation: testCase.explanation } : {}),
    }));
  } else if (
    rawExamples.length > 0 &&
    rawExamples.every((testCase) => isRecord(testCase) && typeof testCase.output === "string") &&
    legacyStructuredCases.length > 0
  ) {
    const availableCases = legacyStructuredCases.map((testCase, index) =>
      normalizeTestCase(testCase, slug, "testCasesJson", index)
    );
    const selected = new Set();
    examples = rawExamples.map((legacyExample, index) => {
      const expectedText = legacyExample.output.trim().replace(/\\s+/g, " ");
      const matched = availableCases.find((candidate, candidateIndex) =>
        !selected.has(candidateIndex) && formatLegacyOutput(candidate.expected).trim().replace(/\\s+/g, " ") === expectedText
      );
      if (!matched) {
        throw new Error(`${slug}: legacy example ${index + 1} does not match a structured test case; migrate it manually.`);
      }
      const matchedIndex = availableCases.indexOf(matched);
      selected.add(matchedIndex);
      return {
        ...matched,
        ...(typeof legacyExample.explanation === "string" ? { explanation: legacyExample.explanation } : {}),
      };
    });
  } else {
    throw new Error(`${slug}: examples are not in a supported JSON function shape.`);
  }
  if (examples.length === 0) {
    throw new Error(`${slug}: at least one visible example is required.`);
  }

  const candidates = [
    ...(Array.isArray(problem.hiddenTestCases) ? problem.hiddenTestCases : []),
    ...legacyStructuredCases,
    ...(legacyStructuredCases.length === 0 && Array.isArray(problem.testCases) ? problem.testCases : []),
  ].map((testCase, index) => normalizeTestCase(testCase, slug, "test cases", index));

  for (const testCase of [...examples, ...candidates]) {
    if (testCase.args.length !== functionSpec.params.length) {
      throw new Error(`${slug}: test case ${testCase.id} has ${testCase.args.length} arguments; expected ${functionSpec.params.length}.`);
    }
  }

  const visibleValues = examples.map(caseValue);
  const hiddenTestCases = [];
  const normalizedExamples = [];
  const seenCases = [];
  let nextId = Math.max(0, ...examples.map((testCase) => testCase.id)) + 1;

  for (const example of examples) {
    const idInUse = seenCases.some((seen) => seen.id === example.id);
    while (idInUse && seenCases.some((seen) => seen.id === nextId)) nextId++;
    const normalized = { ...example, id: idInUse ? nextId++ : example.id };
    normalizedExamples.push(normalized);
    seenCases.push(normalized);
  }

  for (const candidate of candidates) {
    if (visibleValues.some((visible) => isDeepStrictEqual(visible, caseValue(candidate)))) continue;
    if (seenCases.some((seen) => isDeepStrictEqual(caseValue(seen), caseValue(candidate)))) continue;

    const idInUse = seenCases.some((seen) => seen.id === candidate.id);
    while (idInUse && seenCases.some((seen) => seen.id === nextId)) nextId++;
    const assignedId = idInUse ? nextId++ : candidate.id;
    nextId = Math.max(nextId, assignedId + 1);
    const normalized = { ...candidate, id: assignedId };
    hiddenTestCases.push(normalized);
    seenCases.push(normalized);
  }

  const topics = Array.isArray(problem.topics)
    ? problem.topics.filter((topic) => typeof topic === "string" && topic.trim()).map((topic) => topic.trim())
    : [];
  if (topics.length === 0 && typeof problem.category === "string" && problem.category.trim()) {
    topics.push(problem.category.trim());
  }

  const companies = Array.isArray(problem.companies)
    ? problem.companies.filter((company) => typeof company === "string" && company.trim()).map((company) => company.trim())
    : [];

  const set = {
    schemaVersion: 1,
    topics: [...new Set(topics)],
    companies: [...new Set(companies)],
    examples: normalizedExamples,
    hiddenTestCases,
  };
  const needsUpdate =
    Object.entries(set).some(([key, value]) => !isDeepStrictEqual(problem[key], value)) ||
    ["category", "testCasesJson", "testCases"].some((key) => Object.hasOwn(problem, key));

  return {
    needsUpdate,
    update: {
      $set: needsUpdate ? { ...set, updatedAt: new Date() } : set,
      $unset: {
        category: "",
        testCasesJson: "",
        testCases: "",
      },
    },
  };
}

try {
  await mongoose.connect(uri);
  const collection = mongoose.connection.collection("problems");
  const query = slugFilter ? { slug: slugFilter } : {};
  const problems = await collection.find(query).toArray();

  if (slugFilter && problems.length === 0) {
    throw new Error(`No problem with slug ${JSON.stringify(slugFilter)} exists in MongoDB.`);
  }

  const migrations = [];
  const errors = [];
  for (const problem of problems) {
    try {
      const migration = migrateProblem(problem);
      migrations.push({ problem, ...migration });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Unknown migration error for ${problem.slug}.`);
    }
  }

  if (errors.length > 0) {
    console.error("Problem migration validation failed; no records were changed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else if (dryRun) {
    const pending = migrations.filter((migration) => migration.needsUpdate).length;
    console.log(`Validated ${migrations.length} problem(s); ${pending} need migration. No records changed.`);
  } else {
    let migratedCount = 0;
    for (const { problem, update, needsUpdate } of migrations) {
      if (!needsUpdate) {
        console.log(`Up-to-date ${problem.slug}`);
        continue;
      }
      await collection.updateOne({ _id: problem._id }, update);
      migratedCount++;
      console.log(`Migrated ${problem.slug}`);
    }
    console.log(`Migrated ${migratedCount} problem(s).`);
  }
} finally {
  await mongoose.disconnect();
}
