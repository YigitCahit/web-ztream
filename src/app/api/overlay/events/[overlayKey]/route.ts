import { NextRequest, NextResponse } from "next/server";

import { getUserProfileByOverlayKey, readOverlayEvents } from "@/lib/profile";

type RouteContext = {
  params: Promise<{
    overlayKey: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { overlayKey } = await context.params;
  const profile = await getUserProfileByOverlayKey(overlayKey);

  if (!profile) {
    return NextResponse.json({ error: "Overlay bulunamadi." }, { status: 404 });
  }

  const cursorParam = request.nextUrl.searchParams.get("cursor");
  const cursor = Number(cursorParam);
  const safeCursor = Number.isFinite(cursor) ? cursor : 0;

  const events = await readOverlayEvents(profile.userId);
  const freshEvents = events
    .filter((event) => event.createdAt > safeCursor)
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(-100);

  const latestTimestamp = freshEvents.at(-1)?.createdAt ?? safeCursor;

  return NextResponse.json(
    {
      events: freshEvents,
      nextCursor: latestTimestamp,
      serverTime: Date.now(),
    },
    { status: 200 },
  );
}
