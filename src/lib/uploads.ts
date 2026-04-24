import "server-only";

import { put } from "@vercel/blob";

const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/webp", "image/gif"]);
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "-");
  return cleaned.slice(0, 80) || "sprite.png";
}

export function validateSpriteUpload(file: File): string | null {
  if (!file || file.size === 0) {
    return "Lutfen bir dosya secin.";
  }

  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return "Sadece PNG, WEBP veya GIF dosyalari kabul edilir.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Dosya boyutu 4MB sinirini asiyor.";
  }

  return null;
}

export async function uploadSpriteForUser(file: File, userId: number): Promise<string> {
  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (hasBlobToken) {
    const safeName = sanitizeFileName(file.name || "sprite.png");
    const key = `characters/${userId}/${Date.now()}-${safeName}`;

    const uploaded = await put(key, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return uploaded.url;
  }

  // Local/test fallback: sprite verisini veri URL olarak sakliyoruz.
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}
