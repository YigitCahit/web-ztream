import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import { randomToken } from "@/lib/crypto";

const SESSION_TICKET_VERSION = 1;
const SESSION_TICKET_MAX_AGE_MS = 2 * 60 * 1000;
const SESSION_TICKET_CLOCK_SKEW_MS = 60 * 1000;

type SessionTicketPayload = {
  v: number;
  iat: number;
  nonce: string;
  sid: string;
  rt: string;
  sw?: 1;
};

function getTicketSecret(): string {
  return process.env.OAUTH_STATE_SECRET || process.env.KICK_CLIENT_SECRET || "";
}

function signTicketBody(ticketBody: string): string {
  return createHmac("sha256", getTicketSecret())
    .update(ticketBody)
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

export function createSessionFinalizeTicket(input: {
  sessionId: string;
  redirectTo: string;
  subscriptionWarning?: boolean;
}): string {
  const payload: SessionTicketPayload = {
    v: SESSION_TICKET_VERSION,
    iat: Date.now(),
    nonce: randomToken(16),
    sid: input.sessionId,
    rt: input.redirectTo,
    sw: input.subscriptionWarning ? 1 : undefined,
  };

  const ticketBody = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signTicketBody(ticketBody);

  return `${ticketBody}.${signature}`;
}

export function parseSessionFinalizeTicket(ticket: string): {
  sessionId: string;
  redirectTo: string;
  subscriptionWarning: boolean;
} | null {
  const [ticketBody, signature, ...rest] = ticket.split(".");
  if (!ticketBody || !signature || rest.length > 0) {
    return null;
  }

  const expectedSignature = signTicketBody(ticketBody);
  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(ticketBody, "base64url").toString("utf8"),
    ) as Partial<SessionTicketPayload>;

    if (decoded.v !== SESSION_TICKET_VERSION || typeof decoded.iat !== "number") {
      return null;
    }

    if (decoded.iat > Date.now() + SESSION_TICKET_CLOCK_SKEW_MS) {
      return null;
    }

    if (Date.now() - decoded.iat > SESSION_TICKET_MAX_AGE_MS) {
      return null;
    }

    if (typeof decoded.sid !== "string" || decoded.sid.length < 16) {
      return null;
    }

    if (typeof decoded.rt !== "string" || !decoded.rt.startsWith("/")) {
      return null;
    }

    if (typeof decoded.nonce !== "string" || decoded.nonce.length < 8) {
      return null;
    }

    return {
      sessionId: decoded.sid,
      redirectTo: decoded.rt,
      subscriptionWarning: decoded.sw === 1,
    };
  } catch {
    return null;
  }
}
