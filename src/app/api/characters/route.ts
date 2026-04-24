import { NextRequest, NextResponse } from "next/server";

import type { StoredCharacter } from "@/types/domain";
import { getSessionFromRequest } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import {
  addCharacterToUserProfile,
  getUserProfileById,
  setActiveCharacterForUserProfile,
} from "@/lib/profile";
import { uploadSpriteForUser, validateSpriteUpload } from "@/lib/uploads";

function parseNumber(
  input: FormDataEntryValue | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof input !== "string") {
    return fallback;
  }

  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(parsed)));
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

  return NextResponse.json(
    {
      characters: profile.characters,
      activeCharacterId: profile.activeCharacterId,
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 });
  }

  const profile = await getUserProfileById(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "Profil bulunamadi." }, { status: 404 });
  }

  const formData = await request.formData();
  const fileValue = formData.get("sprite");
  const file = fileValue instanceof File ? fileValue : null;

  if (!file) {
    return NextResponse.json(
      { error: "Sprite dosyasi gonderilmedi." },
      { status: 400 },
    );
  }

  const uploadError = validateSpriteUpload(file);
  if (uploadError) {
    return NextResponse.json({ error: uploadError }, { status: 400 });
  }

  try {
    const spriteUrl = await uploadSpriteForUser(file, session.userId);
    const nameInput = formData.get("name");
    const characterName =
      typeof nameInput === "string" && nameInput.trim().length > 0
        ? nameInput.trim().slice(0, 32)
        : `Karakter ${profile.characters.length + 1}`;

    const newCharacter: StoredCharacter = {
      id: `char_${randomToken(14)}`,
      name: characterName,
      spriteUrl,
      frameWidth: parseNumber(formData.get("frameWidth"), 100, 16, 512),
      frameHeight: parseNumber(formData.get("frameHeight"), 100, 16, 512),
      frames: parseNumber(formData.get("frames"), 8, 1, 32),
      displaySize: parseNumber(formData.get("displaySize"), 260, 64, 600),
      createdAt: new Date().toISOString(),
    };

    const updated = await addCharacterToUserProfile(profile, newCharacter);

    return NextResponse.json(
      {
        character: newCharacter,
        characters: updated.characters,
        activeCharacterId: updated.activeCharacterId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Karakter yukleme hatasi:", error);
    return NextResponse.json(
      { error: "Karakter yuklenirken bir hata olustu." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 });
  }

  const profile = await getUserProfileById(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "Profil bulunamadi." }, { status: 404 });
  }

  const body = (await request.json()) as { characterId?: string };
  const characterId = body.characterId;
  if (!characterId) {
    return NextResponse.json(
      { error: "characterId alani zorunludur." },
      { status: 400 },
    );
  }

  const updated = await setActiveCharacterForUserProfile(profile, characterId);

  return NextResponse.json(
    {
      activeCharacterId: updated.activeCharacterId,
      characters: updated.characters,
    },
    { status: 200 },
  );
}
