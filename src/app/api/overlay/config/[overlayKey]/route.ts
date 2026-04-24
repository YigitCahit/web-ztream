import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getActiveCharacter, getUserProfileByOverlayKey } from "@/lib/profile";

type RouteContext = {
  params: Promise<{
    overlayKey: string;
  }>;
};

export async function GET(_: Request, context: RouteContext): Promise<NextResponse> {
  const { overlayKey } = await context.params;

  const profile = await getUserProfileByOverlayKey(overlayKey);
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
