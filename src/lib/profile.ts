import "server-only";

import type { OverlayEvent, StoredCharacter, UserProfile } from "@/types/domain";
import { randomToken } from "@/lib/crypto";
import { keys } from "@/lib/keys";
import { appendToList, deleteKey, getJson, readList, setJson } from "@/lib/store";

const PROFILE_TTL_SECONDS = 60 * 60 * 24 * 90;
const EVENTS_TTL_SECONDS = 60 * 60 * 24;

function createBaseCharacter(
  id: string,
  name: string,
  spriteUrl: string,
): StoredCharacter {
  return {
    id,
    name,
    spriteUrl,
    frameWidth: 100,
    frameHeight: 100,
    frames: 8,
    displaySize: 260,
    createdAt: new Date().toISOString(),
  };
}

export function createDefaultCharacterSet(): StoredCharacter[] {
  return [
    createBaseCharacter("default-knight", "Sovalye", "/karakter.png"),
    createBaseCharacter("default-knight-2", "Sovalye 2", "/karakter2.png"),
  ];
}

function normalizeProfile(profile: UserProfile): UserProfile {
  const normalizedCharacters =
    profile.characters.length > 0 ? profile.characters : createDefaultCharacterSet();

  const activeExists = normalizedCharacters.some(
    (character) => character.id === profile.activeCharacterId,
  );

  return {
    ...profile,
    characters: normalizedCharacters,
    activeCharacterId: activeExists
      ? profile.activeCharacterId
      : normalizedCharacters[0]?.id ?? null,
  };
}

async function generateUniqueOverlayKey(): Promise<string> {
  for (let index = 0; index < 12; index += 1) {
    const candidate = randomToken(24);
    const existingUserId = await getJson<number>(keys.overlayUserMap(candidate));
    if (!existingUserId) {
      return candidate;
    }
  }

  return randomToken(30);
}

async function resolveNewOverlayKey(
  userId: number,
  preferredOverlayKey?: string,
): Promise<string> {
  const preferred = preferredOverlayKey?.trim();
  if (preferred && preferred.length > 0) {
    const existingUserId = await getJson<number>(keys.overlayUserMap(preferred));
    if (!existingUserId || existingUserId === userId) {
      return preferred;
    }
  }

  return generateUniqueOverlayKey();
}

export async function saveUserProfile(profile: UserProfile): Promise<UserProfile> {
  const normalized = normalizeProfile({
    ...profile,
    updatedAt: new Date().toISOString(),
  });

  await setJson(keys.userProfile(normalized.userId), normalized, PROFILE_TTL_SECONDS);
  await setJson(
    keys.overlayUserMap(normalized.overlayKey),
    normalized.userId,
    PROFILE_TTL_SECONDS,
  );

  return normalized;
}

export async function getUserProfileById(
  userId: number,
): Promise<UserProfile | null> {
  const profile = await getJson<UserProfile>(keys.userProfile(userId));
  if (!profile) {
    return null;
  }

  const normalized = normalizeProfile(profile);

  // Overlay routes resolve by overlayKey -> userId. Rehydrate this index on reads.
  await setJson(
    keys.overlayUserMap(normalized.overlayKey),
    normalized.userId,
    PROFILE_TTL_SECONDS,
  );

  return normalized;
}

export async function getUserProfileByOverlayKey(
  overlayKey: string,
): Promise<UserProfile | null> {
  const userId = await getJson<number>(keys.overlayUserMap(overlayKey));
  if (!userId) {
    return null;
  }

  return getUserProfileById(userId);
}

export async function getUserProfileByOverlayLookup(
  overlayKey: string,
  userIdHint?: number,
): Promise<UserProfile | null> {
  const byOverlayMap = await getUserProfileByOverlayKey(overlayKey);
  if (byOverlayMap) {
    return byOverlayMap;
  }

  if (!Number.isFinite(userIdHint) || !userIdHint || userIdHint <= 0) {
    return null;
  }

  const byUserId = await getUserProfileById(userIdHint);
  if (!byUserId) {
    return null;
  }

  if (byUserId.overlayKey !== overlayKey) {
    return null;
  }

  return byUserId;
}

export async function getOrCreateUserProfile(
  userId: number,
  username: string,
  preferredOverlayKey?: string,
): Promise<UserProfile> {
  const existing = await getUserProfileById(userId);
  if (existing) {
    return saveUserProfile({
      ...existing,
      username,
    });
  }

  const overlayKey = await resolveNewOverlayKey(userId, preferredOverlayKey);
  const defaults = createDefaultCharacterSet();
  const now = new Date().toISOString();

  const profile: UserProfile = {
    userId,
    username,
    overlayKey,
    createdAt: now,
    updatedAt: now,
    characters: defaults,
    activeCharacterId: defaults[0]?.id ?? null,
  };

  return saveUserProfile(profile);
}

export function getActiveCharacter(profile: UserProfile): StoredCharacter {
  const fallback = profile.characters[0] ?? createDefaultCharacterSet()[0];
  return (
    profile.characters.find((character) => character.id === profile.activeCharacterId) ??
    fallback
  );
}

export async function pushOverlayEvent(
  broadcasterUserId: number,
  event: OverlayEvent,
): Promise<void> {
  await appendToList(keys.overlayEvents(broadcasterUserId), event, 600, EVENTS_TTL_SECONDS);
}

export async function readOverlayEvents(broadcasterUserId: number): Promise<OverlayEvent[]> {
  return readList<OverlayEvent>(keys.overlayEvents(broadcasterUserId));
}

export async function addCharacterToUserProfile(
  profile: UserProfile,
  character: StoredCharacter,
): Promise<UserProfile> {
  const updated = {
    ...profile,
    characters: [...profile.characters, character],
    activeCharacterId: character.id,
  };

  return saveUserProfile(updated);
}

export async function setActiveCharacterForUserProfile(
  profile: UserProfile,
  characterId: string,
): Promise<UserProfile> {
  const exists = profile.characters.some((character) => character.id === characterId);
  if (!exists) {
    return profile;
  }

  return saveUserProfile({
    ...profile,
    activeCharacterId: characterId,
  });
}

export async function deleteCharacterFromUserProfile(
  profile: UserProfile,
  characterId: string,
): Promise<UserProfile> {
  const remaining = profile.characters.filter((character) => character.id !== characterId);

  const nextCharacters = remaining.length > 0 ? remaining : createDefaultCharacterSet();
  const nextActive =
    nextCharacters.find((character) => character.id === profile.activeCharacterId)?.id ??
    nextCharacters[0]?.id ??
    null;

  return saveUserProfile({
    ...profile,
    characters: nextCharacters,
    activeCharacterId: nextActive,
  });
}

export async function removeUserProfile(userId: number): Promise<void> {
  const profile = await getUserProfileById(userId);
  if (profile) {
    await deleteKey(keys.overlayUserMap(profile.overlayKey));
  }

  await deleteKey(keys.userProfile(userId));
}
