import { NextRequest, NextResponse } from "next/server";

import type { DashboardPayload } from "@/types/domain";
import { getSessionFromRequest } from "@/lib/auth";
import { env } from "@/lib/env";
import { ensureChatMessageSubscription } from "@/lib/kick";
import { getUserProfileById } from "@/lib/profile";
import { getStorageMode } from "@/lib/store";
import { getOriginFromRequestUrl } from "@/lib/url";

function buildWarnings(): string[] {
  const warnings: string[] = [];

  if (getStorageMode() === "memory") {
    warnings.push(
      "Kalici veri katmani icin KV_REST_API_URL ve KV_REST_API_TOKEN ekleyin. Aksi halde veri sadece gecici bellekte kalir.",
    );
  }

  if (!env.hasBlobToken) {
    warnings.push(
      "BLOB_READ_WRITE_TOKEN tanimli degil. Yuklenen karakterler kalici depolanmayacak.",
    );
  }

  return warnings;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 });
  }

  const profile = await getUserProfileById(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "Profil bulunamadi." }, { status: 404 });
  }

  const origin = getOriginFromRequestUrl(request.url);
  const payload: DashboardPayload = {
    username: profile.username,
    userId: profile.userId,
    overlayKey: profile.overlayKey,
    overlayUrl: `${origin}/overlay/${profile.overlayKey}`,
    characters: profile.characters,
    activeCharacterId: profile.activeCharacterId,
    warnings: buildWarnings(),
  };

  return NextResponse.json(payload, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 });
  }

  try {
    await ensureChatMessageSubscription(session.accessToken);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Subscription yenileme hatasi:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Abonelik yenilenemedi. Token suresi dolmus olabilir, lutfen yeniden giris yapin.",
      },
      { status: 400 },
    );
  }
}
