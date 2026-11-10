import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.resolve(process.argv[2] ?? path.join(scriptDirectory, "../../leetcode-companywise-interview-questions"));
const outputFile = path.resolve(scriptDirectory, "../src/lib/company-playlists.json");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function displayCompanyName(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}

function slugFromUrl(value) {
  const url = new URL(value);
  const segments = url.pathname.split("/").filter(Boolean);
  const problemsIndex = segments.indexOf("problems");
  return problemsIndex >= 0 ? segments[problemsIndex + 1] ?? "" : "";
}

const entries = await readdir(sourceDirectory, { withFileTypes: true });
const companies = [];
for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const csvFile = path.join(sourceDirectory, entry.name, "all.csv");
  let csvText;
  try {
    csvText = await readFile(csvFile, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
    throw error;
  }

  const [headers = [], ...rows] = parseCsv(csvText.replace(/^\uFEFF/, ""));
  const headerIndex = new Map(headers.map((header, index) => [header.trim(), index]));
  const titleIndex = headerIndex.get("Title");
  const urlIndex = headerIndex.get("URL");
  const difficultyIndex = headerIndex.get("Difficulty");
  if (titleIndex === undefined || urlIndex === undefined) {
    throw new Error(`${csvFile} must contain URL and Title columns.`);
  }

  const seenSlugs = new Set();
  const problems = [];
  for (const row of rows) {
    const title = row[titleIndex]?.trim();
    const sourceUrl = row[urlIndex]?.trim();
    if (!title || !sourceUrl) continue;
    const slug = slugFromUrl(sourceUrl);
    if (!slugPattern.test(slug) || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    const difficulty = row[difficultyIndex]?.trim();
    problems.push({
      slug,
      title,
      topic: "Company Questions",
      difficulty: ["Easy", "Medium", "Hard"].includes(difficulty) ? difficulty : null,
    });
  }
  if (problems.length > 0) {
    companies.push({
      id: entry.name,
      name: displayCompanyName(entry.name),
      description: `Interview questions reported for ${displayCompanyName(entry.name)}.`,
      problems,
    });
  }
}

await writeFile(outputFile, `${JSON.stringify(companies)}\n`);
const questionCount = companies.reduce((total, company) => total + company.problems.length, 0);
console.log(`Generated ${companies.length} company playlists (${questionCount} problem entries) at ${outputFile}`);
