import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import type { OAuthStateRecord } from "@/types/domain";
import { randomToken } from "@/lib/crypto";

const OAUTH_STATE_VERSION = 1;
const OAUTH_STATE_MAX_AGE_MS = 60 * 10 * 1000;
const OAUTH_STATE_CLOCK_SKEW_MS = 60 * 1000;

type OAuthStatePayload = {
  v: number;
  iat: number;
  nonce: string;
  codeVerifier: string;
  redirectTo: string;
  redirectUri: string;
};

function getStateSecret(): string {
  return process.env.OAUTH_STATE_SECRET || process.env.KICK_CLIENT_SECRET || "";
}

function signStateBody(stateBody: string): string {
  return createHmac("sha256", getStateSecret()).update(stateBody).digest("base64url");
}

function isValidRedirectUri(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createOAuthState(input: {
  codeVerifier: string;
  redirectTo: string;
  redirectUri: string;
}): string {
  const payload: OAuthStatePayload = {
    v: OAUTH_STATE_VERSION,
    iat: Date.now(),
    nonce: randomToken(16),
    codeVerifier: input.codeVerifier,
    redirectTo: input.redirectTo,
    redirectUri: input.redirectUri,
  };

  const stateBody = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signStateBody(stateBody);

  return `${stateBody}.${signature}`;
}

export function parseOAuthState(state: string): OAuthStateRecord | null {
  const [stateBody, signature, ...rest] = state.split(".");
  if (!stateBody || !signature || rest.length > 0) {
    return null;
  }

  const expectedSignature = signStateBody(stateBody);
  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(stateBody, "base64url").toString("utf8"),
    ) as Partial<OAuthStatePayload>;

    if (decoded.v !== OAUTH_STATE_VERSION || typeof decoded.iat !== "number") {
      return null;
    }

    if (
      typeof decoded.codeVerifier !== "string" ||
      decoded.codeVerifier.length < 43 ||
      decoded.codeVerifier.length > 128
    ) {
      return null;
    }

    if (typeof decoded.redirectUri !== "string" || !isValidRedirectUri(decoded.redirectUri)) {
      return null;
    }

    if (typeof decoded.redirectTo !== "string") {
      return null;
    }

    if (typeof decoded.nonce !== "string" || decoded.nonce.length < 8) {
      return null;
    }

    if (
      decoded.iat > Date.now() + OAUTH_STATE_CLOCK_SKEW_MS ||
      Date.now() - decoded.iat > OAUTH_STATE_MAX_AGE_MS
    ) {
      return null;
    }

    return {
      codeVerifier: decoded.codeVerifier,
      createdAt: decoded.iat,
      redirectTo: decoded.redirectTo.startsWith("/")
        ? decoded.redirectTo
        : "/dashboard",
      redirectUri: decoded.redirectUri,
    };
  } catch {
    return null;
  }
}
