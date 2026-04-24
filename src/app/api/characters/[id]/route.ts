import { NextRequest, NextResponse } from "next/server";

import { getSessionFromRequest } from "@/lib/auth";
import {
  deleteCharacterFromUserProfile,
  getUserProfileById,
} from "@/lib/profile";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 });
  }

  const profile = await getUserProfileById(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "Profil bulunamadi." }, { status: 404 });
  }

  const { id } = await context.params;
  const exists = profile.characters.some((character) => character.id === id);
  if (!exists) {
    return NextResponse.json(
      { error: "Silinecek karakter bulunamadi." },
      { status: 404 },
    );
  }

  const updated = await deleteCharacterFromUserProfile(profile, id);

  return NextResponse.json(
    {
      characters: updated.characters,
      activeCharacterId: updated.activeCharacterId,
    },
    { status: 200 },
  );
}
