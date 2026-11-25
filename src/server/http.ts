const decoder = new TextDecoder();

export class BodyTooLargeError extends Error {}

export const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export function parseCoordinate(raw: string | null, maxAbsoluteValue: number): number | null {
  const value = raw?.trim() ?? "";
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= maxAbsoluteValue ? number : null;
}

/** Reads JSON with an enforced byte cap even when Content-Length is absent. */
export async function readJsonWithByteLimit(message: Request | Response, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(message.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new BodyTooLargeError("JSON body exceeds the safe size");
  }
  if (!message.body) throw new Error("Missing JSON body");

  const reader = message.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new BodyTooLargeError("JSON body exceeds the safe size");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(decoder.decode(bytes));
}
