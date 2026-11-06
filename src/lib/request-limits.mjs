export const MAX_REQUEST_BYTES = 1024 * 1024;
export const MAX_SOURCE_BYTES = 128 * 1024;

export function sourceCodeWithinLimit(sourceCode) {
  return Buffer.byteLength(sourceCode, "utf8") <= MAX_SOURCE_BYTES;
}

export async function readBoundedBody(stream, maxBytes) {
  const reader = stream?.getReader();
  if (!reader) return "";

  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes).toString("utf8");
}
