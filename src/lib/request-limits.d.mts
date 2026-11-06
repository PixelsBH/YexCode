export const MAX_REQUEST_BYTES: number;
export const MAX_SOURCE_BYTES: number;

export function sourceCodeWithinLimit(sourceCode: string): boolean;
export function readBoundedBody(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number
): Promise<string | null>;
