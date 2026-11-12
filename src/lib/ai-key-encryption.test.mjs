import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { decryptAiKey, encryptAiKey } from "./ai-key-encryption.mjs";

const originalKey = process.env.AI_KEY_ENCRYPTION_KEY;
before(() => { process.env.AI_KEY_ENCRYPTION_KEY = "0123456789abcdef".repeat(4); });
after(() => {
  if (originalKey === undefined) delete process.env.AI_KEY_ENCRYPTION_KEY;
  else process.env.AI_KEY_ENCRYPTION_KEY = originalKey;
});

test("AI key encryption round-trips and stores no plaintext", () => {
  const apiKey = "gsk_example-user-provided-secret-key";
  const encrypted = encryptAiKey(apiKey);
  assert.notEqual(encrypted.ciphertext, apiKey);
  assert.equal(decryptAiKey(encrypted), apiKey);
  assert.equal(Buffer.from(encrypted.iv, "base64").length, 12);
  assert.equal(Buffer.from(encrypted.authTag, "base64").length, 16);
});

test("AI key encryption uses a fresh nonce for each save", () => {
  const first = encryptAiKey("same-api-key");
  const second = encryptAiKey("same-api-key");
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test("AI key decryption rejects modified ciphertext and unknown versions", () => {
  const encrypted = encryptAiKey("api-key-to-protect");
  const tag = Buffer.from(encrypted.authTag, "base64");
  tag[0] ^= 1;
  const changedTag = { ...encrypted, authTag: tag.toString("base64") };
  assert.throws(() => decryptAiKey(changedTag));
  assert.throws(() => decryptAiKey({ ...encrypted, keyVersion: "v2" }), /Unsupported/);
});

test("AI key encryption requires a 32-byte hex secret", () => {
  const configuredKey = process.env.AI_KEY_ENCRYPTION_KEY;
  delete process.env.AI_KEY_ENCRYPTION_KEY;
  assert.throws(() => encryptAiKey("api-key"), /AI_KEY_ENCRYPTION_KEY/);
  process.env.AI_KEY_ENCRYPTION_KEY = configuredKey;
});
