import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_REQUEST_BYTES,
  MAX_SOURCE_BYTES,
  readBoundedBody,
  sourceCodeWithinLimit,
} from "./request-limits.mjs";

function streamOf(...parts) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
      controller.close();
    },
  });
}

test("request and source code limits retain their configured caps", () => {
  assert.equal(MAX_REQUEST_BYTES, 1024 * 1024);
  assert.equal(MAX_SOURCE_BYTES, 128 * 1024);
});

test("source code size is measured in UTF-8 bytes at the boundary", () => {
  assert.equal(sourceCodeWithinLimit("a".repeat(MAX_SOURCE_BYTES)), true);
  assert.equal(sourceCodeWithinLimit("a".repeat(MAX_SOURCE_BYTES + 1)), false);
  assert.equal(sourceCodeWithinLimit("é".repeat(MAX_SOURCE_BYTES / 2)), true);
});

test("bounded body reader accepts the exact limit and rejects an oversized body", async () => {
  assert.equal(await readBoundedBody(streamOf("1234"), 4), "1234");
  assert.equal(await readBoundedBody(streamOf("12345"), 4), null);
});

test("bounded body reader enforces limits across chunks", async () => {
  assert.equal(await readBoundedBody(streamOf("12", "34"), 4), "1234");
  assert.equal(await readBoundedBody(streamOf("12", "345"), 4), null);
});
