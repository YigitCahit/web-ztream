import { NextRequest, NextResponse } from "next/server";

import { sha256Base64Url, randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { buildKickAuthorizeUrl } from "@/lib/kick";
import { createOAuthState } from "@/lib/oauth-state";
import { getOriginFromRequestUrl } from "@/lib/url";

function getSafeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!env.kickClientId || !env.kickClientSecret) {
    return NextResponse.json(
      {
        error:
          "KICK_CLIENT_ID ve KICK_CLIENT_SECRET ayarlari eksik. Lutfen .env degerlerini doldurun.",
      },
      { status: 500 },
    );
  }

  const origin = getOriginFromRequestUrl(request.url);
  const redirectUri =
    env.kickRedirectUri && env.kickRedirectUri.length > 0
      ? env.kickRedirectUri
      : `${origin}/api/auth/callback`;

  const codeVerifier = randomToken(96);
  const codeChallenge = sha256Base64Url(codeVerifier);
  const redirectTo = getSafeRedirectPath(request.nextUrl.searchParams.get("redirect"));
  const state = createOAuthState({
    codeVerifier,
    redirectTo,
    redirectUri,
  });

  const authorizeUrl = buildKickAuthorizeUrl({
    clientId: env.kickClientId,
    redirectUri,
    scopes: env.kickScopes,
    state,
    codeChallenge,
  });

  return NextResponse.redirect(authorizeUrl);
}
