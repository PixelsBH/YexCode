import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { validateProblems } from "./problem-validation.mjs";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    let value = match[2];
    if (value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadLocalEnv();

if (process.env.NODE_ENV === "production") {
  throw new Error("Problem fixtures include development-only reference solutions. Metadata sync is disabled when NODE_ENV=production.");
}

const fixturePath = path.join(process.cwd(), "data", "problems.json");
const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const validationErrors = validateProblems(fixtures);
if (validationErrors.length > 0) {
  throw new Error(`Problem fixtures are invalid:\n- ${validationErrors.join("\n- ")}`);
}

const dryRun = process.argv.includes("--dry-run");
const slugOptionIndex = process.argv.indexOf("--slug");
const slugFilter = slugOptionIndex >= 0 ? process.argv[slugOptionIndex + 1] : undefined;
if (slugOptionIndex >= 0 && !slugFilter) throw new Error("--slug requires a problem slug.");
const problems = slugFilter ? fixtures.filter((problem) => problem.slug === slugFilter) : fixtures;
if (slugFilter && problems.length === 0) throw new Error(`No fixture with slug ${JSON.stringify(slugFilter)} exists.`);

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not configured. Add it to .env.local or the environment.");

try {
  await mongoose.connect(uri);
  const collection = mongoose.connection.collection("problems");
  const existingRecords = await collection.find(
    { slug: { $in: problems.map((problem) => problem.slug) } },
    { projection: { _id: 1, slug: 1 } },
  ).toArray();
  const existingBySlug = new Map(existingRecords.map((record) => [record.slug, record]));
  const missing = problems.map((problem) => problem.slug).filter((slug) => !existingBySlug.has(slug));
  if (missing.length > 0) {
    throw new Error(`No database problem record exists for: ${missing.join(", ")}. Seed those records before syncing metadata.`);
  }

  let updated = 0;
  for (const problem of problems) {
    const existing = existingBySlug.get(problem.slug);
    if (dryRun) {
      console.log(`Would sync public metadata and private reference solution for ${problem.slug}`);
      continue;
    }

    const result = await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          topics: problem.topics,
          companies: problem.companies,
          hints: problem.hints,
          referenceSolution: problem.referenceSolution,
          updatedAt: new Date(),
        },
      },
    );
    if (result.matchedCount === 1) updated++;
  }
  console.log(dryRun
    ? `Validated ${problems.length} metadata update(s); no records changed.`
    : `Synced metadata for ${updated} problem(s). Test suites were not modified.`);
} finally {
  await mongoose.disconnect();
}
