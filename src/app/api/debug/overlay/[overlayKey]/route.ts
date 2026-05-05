import { NextRequest, NextResponse } from "next/server";

import { getUserProfileByOverlayLookup, readOverlayEvents } from "@/lib/profile";
import { keys } from "@/lib/keys";
import { getJson } from "@/lib/store";

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

  // Lookup profile
  const profile = await getUserProfileByOverlayLookup(overlayKey, userIdHint);

  if (!profile) {
    return NextResponse.json(
      { error: "Overlay bulunamadi.", debug: { overlayKey, userIdHint } },
      { status: 404 },
    );
  }

  // Get events directly
  const events = await readOverlayEvents(profile.userId);

  // Get overlay-user-map to verify webhook writes
  const mapKey = keys.overlayUserMap(overlayKey);
  const mapValue = await getJson<number>(mapKey);

  return NextResponse.json(
    {
      profile: {
        userId: profile.userId,
        username: profile.username,
        overlayKey: profile.overlayKey,
      },
      events: {
        total: events.length,
        recent: events.slice(-5),
      },
      redis: {
        "overlay-user-map-key": mapKey,
        "overlay-user-map-value": mapValue,
        "overlay-events-count": events.length,
      },
    },
    { status: 200 },
  );
}
