import { NextRequest, NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth";
import { parseSessionFinalizeTicket } from "@/lib/session-ticket";

export const runtime = "nodejs";

function buildHomeErrorRedirect(origin: string, message: string): NextResponse {
  const url = new URL("/", origin);
  url.searchParams.set("auth_error", message);
  return NextResponse.redirect(url, { status: 302 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  const ticket = request.nextUrl.searchParams.get("ticket");

  if (!ticket) {
    return buildHomeErrorRedirect(origin, "session_ticket_gecersiz");
  }

  const parsedTicket = parseSessionFinalizeTicket(ticket);
  if (!parsedTicket) {
    return buildHomeErrorRedirect(origin, "session_ticket_gecersiz");
  }

  const redirectUrl = new URL(parsedTicket.redirectTo, origin);
  if (parsedTicket.subscriptionWarning) {
    redirectUrl.searchParams.set("warning", "subscription");
  }

  const response = NextResponse.redirect(redirectUrl, { status: 302 });
  setSessionCookie(response, parsedTicket.sessionId);
  return response;
}
