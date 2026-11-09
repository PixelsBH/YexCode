import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePlaylistInput } from "./playlist-validation.mjs";

test("personal playlists may include slug links before problem content exists", () => {
  assert.deepEqual(normalizePlaylistInput({
    name: "Interview prep",
    description: "",
    problems: [{ slug: "future-problem", title: "Future Problem", topic: "Graphs" }],
  }), {
    name: "Interview prep",
    description: "",
    problems: [{ slug: "future-problem", title: "Future Problem", topic: "Graphs" }],
  });
});

test("playlist fields are trimmed and missing topic labels get a default", () => {
  assert.deepEqual(normalizePlaylistInput({
    name: "  My list  ",
    problems: [{ slug: "two-sum", title: " Two Sum " }],
  }), {
    name: "My list",
    description: "",
    problems: [{ slug: "two-sum", title: "Two Sum", topic: "Uncategorized" }],
  });
});

test("playlist validation rejects invalid slugs and duplicate entries", () => {
  assert.throws(() => normalizePlaylistInput({ name: "Bad", problems: [{ slug: "Two Sum", title: "Two Sum" }] }), /slug is invalid/);
  assert.throws(() => normalizePlaylistInput({ name: "Duplicate", problems: [
    { slug: "two-sum", title: "Two Sum" },
    { slug: "two-sum", title: "Two Sum Again" },
  ] }), /duplicate problem two-sum/);
});

test("playlist validation enforces collection limits and allowed fields", () => {
  assert.throws(() => normalizePlaylistInput({ name: "" , problems: [] }), /Playlist name is required/);
  assert.throws(() => normalizePlaylistInput({ name: "Private", problems: [], userId: "spoof" }), /unsupported fields/);
  assert.throws(() => normalizePlaylistInput({ name: "Too many", problems: Array.from({ length: 151 }, (_, i) => ({ slug: `problem-${i}`, title: `Problem ${i}` })) }), /at most 150/);
});
