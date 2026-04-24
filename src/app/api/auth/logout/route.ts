import { NextRequest, NextResponse } from "next/server";

import { clearSessionCookie, destroySession, SESSION_COOKIE_NAME } from "@/lib/auth";

async function logout(request: NextRequest): Promise<NextResponse> {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  await destroySession(sessionId);

  const response = NextResponse.redirect(new URL("/", request.url));
  clearSessionCookie(response);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return logout(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return logout(request);
}
