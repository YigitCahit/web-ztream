import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getActiveCharacter, getUserProfileByOverlayLookup } from "@/lib/profile";

type RouteContext = {
  params: Promise<{
    overlayKey: string;
  }>;
};

function parseUserIdHint(value: string | null): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { overlayKey } = await context.params;
  const userIdHint = parseUserIdHint(request.nextUrl.searchParams.get("u"));

  const profile = await getUserProfileByOverlayLookup(overlayKey, userIdHint);
  if (!profile) {
    return NextResponse.json({ error: "Overlay bulunamadi." }, { status: 404 });
  }

  const activeCharacter = getActiveCharacter(profile);

  return NextResponse.json(
    {
      username: profile.username,
      character: activeCharacter,
      settings: {
        avatarLifetimeMs: env.overlayAvatarLifetimeMs,
      },
    },
    { status: 200 },
  );
}
