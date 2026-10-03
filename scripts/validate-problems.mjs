import fs from "node:fs";
import path from "node:path";
import { validateProblems } from "./problem-validation.mjs";

const fixturePath = path.join(process.cwd(), "data", "problems.json");
const problems = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const errors = validateProblems(problems);

if (errors.length > 0) {
  console.error(`Problem fixture validation failed (${errors.length} issue(s)):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${problems.length} versioned problem fixture(s).`);
}
