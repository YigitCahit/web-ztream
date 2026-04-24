import "server-only";

import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { SessionRecord } from "@/types/domain";
import { randomToken } from "@/lib/crypto";
import { keys } from "@/lib/keys";
import { deleteKey, getJson, setJson } from "@/lib/store";

export const SESSION_COOKIE_NAME = "ztream_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionCreateInput = {
  userId: number;
  username: string;
  overlayKey: string;
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt: number;
  scope: string;
};

export async function createSession(input: SessionCreateInput): Promise<SessionRecord> {
  const session: SessionRecord = {
    sessionId: randomToken(48),
    userId: input.userId,
    username: input.username,
    overlayKey: input.overlayKey,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    accessTokenExpiresAt: input.accessTokenExpiresAt,
    scope: input.scope,
    createdAt: Date.now(),
  };

  await setJson(keys.session(session.sessionId), session, SESSION_TTL_SECONDS);
  return session;
}

export async function updateSession(session: SessionRecord): Promise<void> {
  await setJson(keys.session(session.sessionId), session, SESSION_TTL_SECONDS);
}

export async function getSessionById(
  sessionId?: string | null,
): Promise<SessionRecord | null> {
  if (!sessionId) {
    return null;
  }

  return getJson<SessionRecord>(keys.session(sessionId));
}

export async function destroySession(sessionId?: string | null): Promise<void> {
  if (!sessionId) {
    return;
  }

  await deleteKey(keys.session(sessionId));
}

export function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionRecord | null> {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return getSessionById(sessionId);
}

export async function getSessionFromServerComponent(): Promise<SessionRecord | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getSessionById(sessionId);
}
