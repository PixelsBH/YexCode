const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function boundedText(value, label, maxLength, { optional = false } = {}) {
  if (optional && value === undefined) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const normalized = value.trim();
  if (!optional && normalized.length === 0) throw new Error(`${label} is required.`);
  if (normalized.length > maxLength) throw new Error(`${label} must be at most ${maxLength} characters.`);
  return normalized;
}

export function normalizePlaylistInput(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Playlist body must be an object.");
  }
  const allowedKeys = new Set(["name", "description", "problems"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) throw new Error("Playlist body contains unsupported fields.");
  const name = boundedText(value.name, "Playlist name", 80);
  const description = boundedText(value.description, "Playlist description", 300, { optional: true });
  if (!Array.isArray(value.problems) || value.problems.length > 150) {
    throw new Error("Playlist problems must be an array with at most 150 entries.");
  }
  const seen = new Set();
  const problems = value.problems.map((problem, index) => {
    if (problem === null || typeof problem !== "object" || Array.isArray(problem)) {
      throw new Error(`Playlist problem ${index + 1} must be an object.`);
    }
    if (Object.keys(problem).some((key) => !["slug", "title", "topic"].includes(key))) {
      throw new Error(`Playlist problem ${index + 1} contains unsupported fields.`);
    }
    const slug = boundedText(problem.slug, `Playlist problem ${index + 1} slug`, 100);
    if (!SLUG_PATTERN.test(slug)) throw new Error(`Playlist problem ${index + 1} slug is invalid.`);
    if (seen.has(slug)) throw new Error(`Playlist contains duplicate problem ${slug}.`);
    seen.add(slug);
    return {
      slug,
      title: boundedText(problem.title, `Playlist problem ${index + 1} title`, 120),
      topic: boundedText(problem.topic, `Playlist problem ${index + 1} topic`, 80, { optional: true }) || "Uncategorized",
    };
  });
  return { name, description, problems };
}
