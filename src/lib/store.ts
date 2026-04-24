import "server-only";

import { Redis } from "@upstash/redis";

type MemoryValueEntry = {
  value: string;
  expiresAt: number | null;
};

type MemoryListEntry = {
  values: string[];
  expiresAt: number | null;
};

declare global {
  var __ztreamMemoryKv: Map<string, MemoryValueEntry> | undefined;
  var __ztreamMemoryLists: Map<string, MemoryListEntry> | undefined;
}

const memoryKv = globalThis.__ztreamMemoryKv ?? new Map<string, MemoryValueEntry>();
const memoryLists =
  globalThis.__ztreamMemoryLists ?? new Map<string, MemoryListEntry>();

globalThis.__ztreamMemoryKv = memoryKv;
globalThis.__ztreamMemoryLists = memoryLists;

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

const now = () => Date.now();

function isExpired(expiresAt: number | null): boolean {
  return expiresAt !== null && expiresAt <= now();
}

function toMemoryExpiry(ttlSeconds?: number): number | null {
  if (!ttlSeconds || ttlSeconds <= 0) {
    return null;
  }

  return now() + ttlSeconds * 1000;
}

function cleanupMemoryKey(key: string): void {
  const entry = memoryKv.get(key);
  if (!entry) {
    return;
  }

  if (isExpired(entry.expiresAt)) {
    memoryKv.delete(key);
  }
}

function cleanupMemoryList(key: string): void {
  const entry = memoryLists.get(key);
  if (!entry) {
    return;
  }

  if (isExpired(entry.expiresAt)) {
    memoryLists.delete(key);
  }
}

async function safeRedisCall<T>(operation: () => Promise<T>): Promise<T | null> {
  if (!redis) {
    return null;
  }

  try {
    return await operation();
  } catch (error) {
    console.error("Redis hatasi:", error);
    return null;
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const redisValue = await safeRedisCall(() => redis!.get<string>(key));

  if (typeof redisValue === "string") {
    return JSON.parse(redisValue) as T;
  }

  cleanupMemoryKey(key);
  const entry = memoryKv.get(key);
  if (!entry) {
    return null;
  }

  return JSON.parse(entry.value) as T;
}

export async function setJson<T>(
  key: string,
  value: T,
  ttlSeconds?: number,
): Promise<void> {
  const serialized = JSON.stringify(value);

  const redisResult = await safeRedisCall(async () => {
    if (ttlSeconds) {
      await redis!.set(key, serialized, { ex: ttlSeconds });
      return true;
    }

    await redis!.set(key, serialized);
    return true;
  });

  if (redisResult) {
    return;
  }

  memoryKv.set(key, {
    value: serialized,
    expiresAt: toMemoryExpiry(ttlSeconds),
  });
}

export async function deleteKey(key: string): Promise<void> {
  const redisResult = await safeRedisCall(async () => {
    await redis!.del(key);
    return true;
  });

  if (redisResult) {
    return;
  }

  memoryKv.delete(key);
  memoryLists.delete(key);
}

export async function setIfAbsent(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  const redisResult = await safeRedisCall(() =>
    redis!.set(key, value, {
      nx: true,
      ex: ttlSeconds,
    }),
  );

  if (redisResult !== null) {
    return redisResult === "OK";
  }

  cleanupMemoryKey(key);
  if (memoryKv.has(key)) {
    return false;
  }

  memoryKv.set(key, {
    value,
    expiresAt: toMemoryExpiry(ttlSeconds),
  });

  return true;
}

export async function appendToList<T>(
  key: string,
  value: T,
  maxItems = 500,
  ttlSeconds = 86_400,
): Promise<void> {
  const serialized = JSON.stringify(value);

  const redisResult = await safeRedisCall(async () => {
    await redis!.rpush(key, serialized);
    await redis!.ltrim(key, -maxItems, -1);
    await redis!.expire(key, ttlSeconds);
    return true;
  });

  if (redisResult) {
    return;
  }

  cleanupMemoryList(key);
  const entry = memoryLists.get(key) ?? { values: [], expiresAt: null };
  entry.values.push(serialized);

  if (entry.values.length > maxItems) {
    entry.values.splice(0, entry.values.length - maxItems);
  }

  entry.expiresAt = toMemoryExpiry(ttlSeconds);
  memoryLists.set(key, entry);
}

export async function readList<T>(key: string): Promise<T[]> {
  const redisValues = await safeRedisCall(() => redis!.lrange<string>(key, 0, -1));
  if (redisValues) {
    return redisValues
      .filter((item): item is string => typeof item === "string")
      .map((item) => JSON.parse(item) as T);
  }

  cleanupMemoryList(key);
  const entry = memoryLists.get(key);
  if (!entry) {
    return [];
  }

  return entry.values.map((item) => JSON.parse(item) as T);
}

export function getStorageMode(): "redis" | "memory" {
  return redis ? "redis" : "memory";
}
