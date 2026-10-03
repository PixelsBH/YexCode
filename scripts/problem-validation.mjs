const requiredKeys = [
  "schemaVersion",
  "slug",
  "title",
  "difficulty",
  "topics",
  "companies",
  "description",
  "constraints",
  "examples",
  "limits",
  "templates",
  "function",
  "hiddenTestCases",
  "hints",
  "referenceSolution",
];
const allowedDifficulties = new Set(["Easy", "Medium", "Hard"]);
const supportedCppTypes = new Set(["int", "long", "longlong", "double", "float", "bool", "string"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cppType(type) {
  if (typeof type !== "string") return "";
  return type.replace(/\b(const|volatile)\b/g, "").replace(/[&*\s]/g, "");
}

function isSupportedType(type) {
  const normalized = cppType(type);
  if (supportedCppTypes.has(normalized)) return true;
  const vector = normalized.match(/^vector<(.+)>$/);
  return vector !== null && isSupportedType(vector[1]);
}

function matchesType(value, type) {
  const normalized = cppType(type);
  if (normalized === "bool") return typeof value === "boolean";
  if (normalized === "string") return typeof value === "string";
  if (["int", "long", "longlong"].includes(normalized)) return Number.isSafeInteger(value);
  if (["double", "float"].includes(normalized)) return typeof value === "number" && Number.isFinite(value);

  const vector = normalized.match(/^vector<(.+)>$/);
  return vector !== null && Array.isArray(value) && value.every((entry) => matchesType(entry, vector[1]));
}

function validateStringArray(value, label, errors, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    errors.push(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array of strings.`);
    return;
  }
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() !== entry || entry.length === 0) {
      errors.push(`${label} entries must be non-empty, trimmed strings.`);
      continue;
    }
    if (seen.has(entry.toLowerCase())) errors.push(`${label} contains duplicate value ${JSON.stringify(entry)}.`);
    seen.add(entry.toLowerCase());
  }
}

function validateTestCases(testCases, label, params, returnType, ids, errors, { requireCases = false } = {}) {
  if (!Array.isArray(testCases) || (requireCases && testCases.length === 0)) {
    errors.push(`${label} must be ${requireCases ? "a non-empty" : "an"} array.`);
    return;
  }

  for (const [index, testCase] of testCases.entries()) {
    const caseLabel = `${label}[${index}]`;
    if (!isRecord(testCase)) {
      errors.push(`${caseLabel} must be an object.`);
      continue;
    }
    if (!Number.isSafeInteger(testCase.id) || testCase.id < 1) {
      errors.push(`${caseLabel}.id must be a positive safe integer.`);
    } else if (ids.has(testCase.id)) {
      errors.push(`${caseLabel}.id ${testCase.id} is duplicated across visible and hidden cases.`);
    } else {
      ids.add(testCase.id);
    }
    if (!Array.isArray(testCase.args) || testCase.args.length !== params.length) {
      errors.push(`${caseLabel}.args must contain exactly ${params.length} value(s).`);
    } else {
      for (const [argIndex, param] of params.entries()) {
        if (!matchesType(testCase.args[argIndex], param.type)) {
          errors.push(`${caseLabel}.args[${argIndex}] does not match C++ type ${JSON.stringify(param.type)}.`);
        }
      }
    }
    if (!Object.hasOwn(testCase, "expected")) {
      errors.push(`${caseLabel}.expected is required.`);
    } else if (!matchesType(testCase.expected, returnType)) {
      errors.push(`${caseLabel}.expected does not match the declared return type.`);
    }
    if (Object.hasOwn(testCase, "explanation") && typeof testCase.explanation !== "string") {
      errors.push(`${caseLabel}.explanation must be a string when provided.`);
    }
  }
}

export function validateProblems(problems) {
  const errors = [];
  if (!Array.isArray(problems) || problems.length === 0) {
    return ["Problem fixtures must be a non-empty JSON array."];
  }

  const slugs = new Set();
  for (const [index, problem] of problems.entries()) {
    const label = isRecord(problem) && typeof problem.slug === "string" ? problem.slug : `problem[${index}]`;
    if (!isRecord(problem)) {
      errors.push(`${label} must be an object.`);
      continue;
    }

    for (const key of requiredKeys) {
      if (!Object.hasOwn(problem, key)) errors.push(`${label}.${key} is required.`);
    }
    const allowedKeys = new Set([...requiredKeys, "createdAt", "updatedAt"]);
    for (const key of Object.keys(problem)) {
      if (!allowedKeys.has(key)) errors.push(`${label}.${key} is not part of schema version 1.`);
    }

    if (problem.schemaVersion !== 1) errors.push(`${label}.schemaVersion must be 1.`);
    if (typeof problem.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(problem.slug) || problem.slug.length > 100) {
      errors.push(`${label}.slug must be a lowercase URL-safe slug.`);
    } else if (slugs.has(problem.slug)) {
      errors.push(`${label}.slug is duplicated.`);
    } else {
      slugs.add(problem.slug);
    }
    if (typeof problem.title !== "string" || !problem.title.trim()) errors.push(`${label}.title must be a non-empty string.`);
    if (!allowedDifficulties.has(problem.difficulty)) errors.push(`${label}.difficulty must be Easy, Medium, or Hard.`);
    if (typeof problem.description !== "string" || !problem.description.trim()) errors.push(`${label}.description must be a non-empty string.`);
    validateStringArray(problem.topics, `${label}.topics`, errors);
    validateStringArray(problem.companies, `${label}.companies`, errors);
    validateStringArray(problem.constraints, `${label}.constraints`, errors, { allowEmpty: false });
    validateStringArray(problem.hints, `${label}.hints`, errors, { allowEmpty: false });

    const functionSpec = problem.function;
    let params = [];
    if (!isRecord(functionSpec) || typeof functionSpec.name !== "string" || !functionSpec.name.trim() ||
      typeof functionSpec.returnType !== "string" || !Array.isArray(functionSpec.params)) {
      errors.push(`${label}.function must define a name, return type, and parameter array.`);
    } else {
      if (!isSupportedType(functionSpec.returnType)) errors.push(`${label}.function.returnType is unsupported: ${JSON.stringify(functionSpec.returnType)}.`);
      const paramNames = new Set();
      params = functionSpec.params;
      for (const [paramIndex, param] of params.entries()) {
        if (!isRecord(param) || typeof param.name !== "string" || !param.name.trim() || typeof param.type !== "string" || !param.type.trim()) {
          errors.push(`${label}.function.params[${paramIndex}] must define a name and type.`);
          continue;
        }
        if (paramNames.has(param.name)) errors.push(`${label}.function has duplicate parameter ${JSON.stringify(param.name)}.`);
        paramNames.add(param.name);
        if (!isSupportedType(param.type)) errors.push(`${label}.function.params[${paramIndex}] has unsupported C++ type ${JSON.stringify(param.type)}.`);
      }
      if (functionSpec.comparison !== undefined &&
        (!isRecord(functionSpec.comparison) || functionSpec.comparison.returnArrayOrder !== "unordered")) {
        errors.push(`${label}.function.comparison only supports returnArrayOrder="unordered".`);
      }
    }

    if (!isRecord(problem.templates) || typeof problem.templates.cpp !== "string" ||
      !/\bclass\s+Solution\b/.test(problem.templates.cpp) || /\bmain\s*\(/.test(problem.templates.cpp)) {
      errors.push(`${label}.templates.cpp must be a class Solution template without main().`);
    }
    if (!isRecord(problem.referenceSolution) || typeof problem.referenceSolution.cpp !== "string" ||
      !/\bclass\s+Solution\b/.test(problem.referenceSolution.cpp) || /\bmain\s*\(/.test(problem.referenceSolution.cpp)) {
      errors.push(`${label}.referenceSolution.cpp must be a class Solution implementation without main().`);
    }

    if (!isRecord(problem.limits) || !Number.isSafeInteger(problem.limits.timeLimitMs) ||
      problem.limits.timeLimitMs < 1 || problem.limits.timeLimitMs > 30_000 ||
      !Number.isSafeInteger(problem.limits.memoryLimitMb) || problem.limits.memoryLimitMb < 16 ||
      problem.limits.memoryLimitMb > 2048) {
      errors.push(`${label}.limits are outside the supported time/memory range.`);
    }

    const ids = new Set();
    const returnType = isRecord(functionSpec) ? functionSpec.returnType : undefined;
    validateTestCases(problem.examples, `${label}.examples`, params, returnType, ids, errors, { requireCases: true });
    validateTestCases(problem.hiddenTestCases, `${label}.hiddenTestCases`, params, returnType, ids, errors, { requireCases: true });
    if (Array.isArray(problem.examples) && Array.isArray(problem.hiddenTestCases) &&
      problem.examples.length + problem.hiddenTestCases.length > 500) {
      errors.push(`${label} exceeds the 500-test-case execution limit.`);
    }
  }

  return errors;
}
