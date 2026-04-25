import { NextRequest, NextResponse } from "next/server";

import { createSession, setSessionCookie } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  ensureChatMessageSubscription,
  exchangeKickCodeForToken,
  fetchKickCurrentUser,
} from "@/lib/kick";
import { parseOAuthState } from "@/lib/oauth-state";
import { getOrCreateUserProfile } from "@/lib/profile";

function buildHomeErrorRedirect(origin: string, message: string): NextResponse {
  const url = new URL("/", origin);
  url.searchParams.set("auth_error", message);
  return NextResponse.redirect(url);
}

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return buildHomeErrorRedirect(origin, "eksik_parametre");
  }

  if (!env.kickClientId || !env.kickClientSecret) {
    return buildHomeErrorRedirect(origin, "kick_ayar_eksik");
  }

  const stateRecord = parseOAuthState(state);

  if (!stateRecord) {
    return buildHomeErrorRedirect(origin, "state_gecersiz");
  }

  try {
    const token = await exchangeKickCodeForToken({
      clientId: env.kickClientId,
      clientSecret: env.kickClientSecret,
      redirectUri: stateRecord.redirectUri,
      code,
      codeVerifier: stateRecord.codeVerifier,
    });

    const kickUser = await fetchKickCurrentUser(token.accessToken);
    const profile = await getOrCreateUserProfile(kickUser.userId, kickUser.username);

    let subscriptionWarning = false;
    try {
      await ensureChatMessageSubscription(token.accessToken);
    } catch (error) {
      subscriptionWarning = true;
      console.error("Kick subscription olusturulamadi:", error);
    }

    const session = await createSession({
      userId: profile.userId,
      username: profile.username,
      overlayKey: profile.overlayKey,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      accessTokenExpiresAt: Date.now() + token.expiresIn * 1000,
      scope: token.scope,
    });

    const redirectPath =
      stateRecord.redirectTo && stateRecord.redirectTo.startsWith("/")
        ? stateRecord.redirectTo
        : "/dashboard";

    const redirectUrl = new URL(redirectPath, origin);
    if (subscriptionWarning) {
      redirectUrl.searchParams.set("warning", "subscription");
    }

    const response = NextResponse.redirect(redirectUrl);
    setSessionCookie(response, session.sessionId);
    return response;
  } catch (error) {
    console.error("OAuth callback hatasi:", error);
    return buildHomeErrorRedirect(origin, "oauth_hatasi");
  }
}
