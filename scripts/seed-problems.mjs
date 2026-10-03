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

if (process.env.NODE_ENV === "production") {
  throw new Error("Problem fixtures include development-only reference solutions. Seeding is disabled when NODE_ENV=production.");
}

const fixturePath = path.join(process.cwd(), "data", "problems.json");
const problems = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const validationErrors = validateProblems(problems);
if (validationErrors.length > 0) {
  throw new Error(`Problem fixtures are invalid:\n- ${validationErrors.join("\n- ")}`);
}

const slugFilter = process.argv[2];
const problemsToSeed = slugFilter
  ? problems.filter((problem) => problem.slug === slugFilter)
  : problems;

if (slugFilter && problemsToSeed.length === 0) {
  throw new Error(`No problem with slug ${JSON.stringify(slugFilter)} exists in ${fixturePath}.`);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not configured. Add it to .env.local or the environment.");
}

try {
  await mongoose.connect(uri);
  const collection = mongoose.connection.collection("problems");

  for (const problem of problemsToSeed) {
    const result = await collection.updateOne(
      { slug: problem.slug },
      {
        $set: { ...problem, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
        $unset: { category: "", testCasesJson: "", testCases: "" },
      },
      { upsert: true }
    );

    if (result.upsertedCount === 1) {
      console.log(`Inserted ${problem.slug}`);
    } else if (result.modifiedCount >= 1) {
      console.log(`Updated ${problem.slug}`);
    } else {
      console.log(`Up-to-date ${problem.slug}`);
    }
  }
} finally {
  await mongoose.disconnect();
}
