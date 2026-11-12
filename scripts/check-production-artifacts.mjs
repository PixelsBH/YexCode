import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDirectories = [path.join(projectRoot, ".next/server"), path.join(projectRoot, ".next/static")];
const fixtureDirectory = path.resolve(projectRoot, "../YCProblems/data/problems");
const textExtensions = new Set([".html", ".js", ".json", ".map"]);

async function collectFiles(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    throw new Error(`Production build output not found: ${directory}. Run the production build first.`);
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath));
    else if (entry.isFile() && textExtensions.has(path.extname(entry.name))) files.push(entryPath);
  }
  return files;
}

function compact(value) {
  return value
    .replace(/\\r?\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, "");
}

const fixtureNames = (await fs.readdir(fixtureDirectory)).filter((name) => name.endsWith(".json"));
if (fixtureNames.length === 0) throw new Error(`No problem fixtures found in ${fixtureDirectory}.`);
const artifacts = (await Promise.all(buildDirectories.map(collectFiles))).flat();
const artifactContents = await Promise.all(artifacts.map((file) => fs.readFile(file, "utf8")));
const normalizedArtifacts = artifactContents.map(compact);
const leakedSlugs = new Set();

for (const fixtureName of fixtureNames) {
  const fixture = JSON.parse(await fs.readFile(path.join(fixtureDirectory, fixtureName), "utf8"));
  const solution = fixture.referenceSolution?.cpp;
  if (typeof solution !== "string" || solution.trim().length === 0) {
    throw new Error(`Fixture ${fixtureName} has no C++ reference solution to verify.`);
  }
  const needle = compact(solution);
  if (normalizedArtifacts.some((artifact) => artifact.includes(needle))) leakedSlugs.add(fixture.slug);
}

if (leakedSlugs.size > 0) {
  console.error(`Production artifact check failed: reference solutions for ${[...leakedSlugs].sort().join(", ")} were found in build output.`);
  process.exitCode = 1;
} else {
  console.log(`Production artifact check passed: scanned ${artifacts.length} build files; no fixture reference solutions found.`);
}
