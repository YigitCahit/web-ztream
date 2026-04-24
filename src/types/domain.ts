export type StoredCharacter = {
  id: string;
  name: string;
  spriteUrl: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  displaySize: number;
  createdAt: string;
};

export type UserProfile = {
  userId: number;
  username: string;
  overlayKey: string;
  createdAt: string;
  updatedAt: string;
  characters: StoredCharacter[];
  activeCharacterId: string | null;
};

export type SessionRecord = {
  sessionId: string;
  userId: number;
  username: string;
  overlayKey: string;
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt: number;
  scope: string;
  createdAt: number;
};

export type OAuthStateRecord = {
  codeVerifier: string;
  createdAt: number;
  redirectTo: string;
  redirectUri: string;
};

export type OverlayEvent = {
  id: string;
  senderUsername: string;
  content: string;
  createdAt: number;
};

export type DashboardPayload = {
  username: string;
  userId: number;
  overlayKey: string;
  overlayUrl: string;
  characters: StoredCharacter[];
  activeCharacterId: string | null;
  warnings: string[];
};
