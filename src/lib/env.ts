import "server-only";

const trimTrailingSlash = (value?: string) => value?.replace(/\/+$/, "");

const parsedLifetime = Number(process.env.OVERLAY_AVATAR_LIFETIME_MS ?? 60_000);

export const env = {
  appUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL),
  kickClientId: process.env.KICK_CLIENT_ID ?? "",
  kickClientSecret: process.env.KICK_CLIENT_SECRET ?? "",
  kickRedirectUri: trimTrailingSlash(process.env.KICK_REDIRECT_URI),
  kickScopes:
    process.env.KICK_SCOPES ?? "user:read channel:read events:subscribe",
  overlayAvatarLifetimeMs:
    Number.isFinite(parsedLifetime) && parsedLifetime > 0 ? parsedLifetime : 60_000,
  hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  hasRedis: Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
};
