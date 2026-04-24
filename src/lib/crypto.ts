import "server-only";

import { createHash, randomBytes } from "crypto";

export function randomToken(size = 48): string {
  const bufferSize = Math.max(16, Math.ceil((size * 3) / 4));
  return randomBytes(bufferSize).toString("base64url").slice(0, size);
}

export function sha256Base64Url(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}
