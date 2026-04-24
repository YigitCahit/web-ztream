import { NextRequest, NextResponse } from "next/server";

import type { OAuthStateRecord } from "@/types/domain";
import { sha256Base64Url, randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { buildKickAuthorizeUrl } from "@/lib/kick";
import { keys } from "@/lib/keys";
import { setJson } from "@/lib/store";
import { getOriginFromRequestUrl } from "@/lib/url";

const OAUTH_STATE_TTL_SECONDS = 60 * 10;

function getSafeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

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

  const state = randomToken(32);
  const codeVerifier = randomToken(96);
  const codeChallenge = sha256Base64Url(codeVerifier);
  const redirectTo = getSafeRedirectPath(request.nextUrl.searchParams.get("redirect"));

  const record: OAuthStateRecord = {
    codeVerifier,
    createdAt: Date.now(),
    redirectTo,
    redirectUri,
  };

  await setJson(keys.oauthState(state), record, OAUTH_STATE_TTL_SECONDS);

  const authorizeUrl = buildKickAuthorizeUrl({
    clientId: env.kickClientId,
    redirectUri,
    scopes: env.kickScopes,
    state,
    codeChallenge,
  });

  return NextResponse.redirect(authorizeUrl);
}
