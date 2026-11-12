import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_VERSION = "v1";
const AAD = Buffer.from("YexCode:GroqCredential:v1", "utf8");

function encryptionKey() {
  const value = process.env.AI_KEY_ENCRYPTION_KEY?.trim();
  if (!value || !/^[a-f\d]{64}$/i.test(value)) {
    throw new Error("AI key encryption is not configured. Set AI_KEY_ENCRYPTION_KEY to a 32-byte hex secret.");
  }
  return Buffer.from(value, "hex");
}

/** @param {string} apiKey */
export function encryptAiKey(apiKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: KEY_VERSION,
  };
}

/** @param {{ ciphertext: string; iv: string; authTag: string; keyVersion: string }} record */
export function decryptAiKey(record) {
  if (record.keyVersion !== KEY_VERSION) throw new Error("Unsupported AI key encryption version.");
  const iv = Buffer.from(record.iv, "base64");
  const authTag = Buffer.from(record.authTag, "base64");
  if (iv.length !== 12 || authTag.length !== 16) throw new Error("Stored AI key encryption data is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
