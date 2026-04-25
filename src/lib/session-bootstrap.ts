import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import type { SessionRecord } from "@/types/domain";

const SESSION_BOOTSTRAP_VERSION = 1;
const SESSION_BOOTSTRAP_MAX_AGE_MS = 60 * 60 * 24 * 30 * 1000;
const SESSION_BOOTSTRAP_CLOCK_SKEW_MS = 60 * 1000;

type SessionBootstrapPayload = {
  v: number;
  iat: number;
  session: SessionRecord;
};

function getBootstrapSecret(): string {
  return process.env.OAUTH_STATE_SECRET || process.env.KICK_CLIENT_SECRET || "";
}

function signPayload(payloadBody: string): string {
  return createHmac("sha256", getBootstrapSecret())
    .update(payloadBody)
    .digest("base64url");
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isValidSessionRecord(value: unknown): value is SessionRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<SessionRecord>;
  return (
    typeof session.sessionId === "string" &&
    session.sessionId.length >= 16 &&
    typeof session.userId === "number" &&
    Number.isFinite(session.userId) &&
    session.userId > 0 &&
    typeof session.username === "string" &&
    session.username.length > 0 &&
    typeof session.overlayKey === "string" &&
    session.overlayKey.length > 0 &&
    typeof session.accessToken === "string" &&
    session.accessToken.length > 0 &&
    typeof session.accessTokenExpiresAt === "number" &&
    Number.isFinite(session.accessTokenExpiresAt) &&
    typeof session.scope === "string" &&
    typeof session.createdAt === "number" &&
    Number.isFinite(session.createdAt)
  );
}

export function createSessionBootstrapToken(session: SessionRecord): string {
  const payload: SessionBootstrapPayload = {
    v: SESSION_BOOTSTRAP_VERSION,
    iat: Date.now(),
    session,
  };

  const payloadBody = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(payloadBody);

  return `${payloadBody}.${signature}`;
}

export function parseSessionBootstrapToken(token: string): SessionRecord | null {
  const [payloadBody, signature, ...rest] = token.split(".");
  if (!payloadBody || !signature || rest.length > 0) {
    return null;
  }

  const expectedSignature = signPayload(payloadBody);
  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payloadBody, "base64url").toString("utf8"),
    ) as Partial<SessionBootstrapPayload>;

    if (decoded.v !== SESSION_BOOTSTRAP_VERSION || typeof decoded.iat !== "number") {
      return null;
    }

    if (decoded.iat > Date.now() + SESSION_BOOTSTRAP_CLOCK_SKEW_MS) {
      return null;
    }

    if (Date.now() - decoded.iat > SESSION_BOOTSTRAP_MAX_AGE_MS) {
      return null;
    }

    if (!isValidSessionRecord(decoded.session)) {
      return null;
    }

    return decoded.session;
  } catch {
    return null;
  }
}
