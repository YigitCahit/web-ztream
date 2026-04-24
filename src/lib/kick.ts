import "server-only";

import { createVerify } from "crypto";

type KickTokenPayload = {
  access_token: string;
  refresh_token?: string;
  expires_in: number | string;
  scope?: string;
};

type KickListResponse<T> = {
  data: T[];
  message?: string;
};

type KickPublicKeyResponse = {
  data?: {
    public_key?: string;
  };
  message?: string;
};

type KickChatEvent = {
  broadcasterUserId: number;
  senderUsername: string;
  content: string;
  eventId: string;
  createdAt: number;
};

const KICK_OAUTH_BASE = "https://id.kick.com";
const KICK_API_BASE = "https://api.kick.com/public/v1";
const CHAT_MESSAGE_EVENT = "chat.message.sent";

const FALLBACK_KICK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

let cachedPublicKey = "";
let cachedPublicKeyExpiresAt = 0;

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

async function readKickError(response: Response): Promise<string> {
  const raw = await response.text();
  if (!raw) {
    return `Kick API hatasi (${response.status})`;
  }

  try {
    const parsed = JSON.parse(raw) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? raw;
  } catch {
    return raw;
  }
}

async function kickApiRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${KICK_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readKickError(response));
  }

  return (await response.json()) as T;
}

function normalizePublicKey(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

export function buildKickAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  scopes: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL("/oauth/authorize", KICK_OAUTH_BASE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scopes);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeKickCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
}> {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
  });

  const response = await fetch(`${KICK_OAUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readKickError(response));
  }

  const payload = (await response.json()) as KickTokenPayload;
  if (!payload.access_token) {
    throw new Error("Kick access token donmedi.");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: Number(payload.expires_in) || 3600,
    scope: payload.scope ?? "",
  };
}

export async function fetchKickCurrentUser(accessToken: string): Promise<{
  userId: number;
  username: string;
}> {
  const usersResponse = await kickApiRequest<
    KickListResponse<{ user_id: number; name?: string }>
  >("/users", accessToken);

  const currentUser = usersResponse.data?.[0];
  if (!currentUser?.user_id) {
    throw new Error("Kick kullanici bilgisi alinamadi.");
  }

  let username = currentUser.name?.trim() || `user-${currentUser.user_id}`;

  try {
    const channelResponse = await kickApiRequest<KickListResponse<{ slug?: string }>>(
      "/channels",
      accessToken,
    );
    const slug = channelResponse.data?.[0]?.slug;
    if (slug && slug.trim().length > 0) {
      username = slug;
    }
  } catch {
    // channel:read scope verilmemisse users yanitiyla devam ediyoruz.
  }

  return {
    userId: currentUser.user_id,
    username,
  };
}

export async function ensureChatMessageSubscription(
  accessToken: string,
): Promise<void> {
  try {
    const existing = await kickApiRequest<
      KickListResponse<{ event?: string; version?: number }>
    >("/events/subscriptions", accessToken);

    const alreadyExists = existing.data?.some(
      (item) => item.event === CHAT_MESSAGE_EVENT && Number(item.version ?? 1) === 1,
    );

    if (alreadyExists) {
      return;
    }
  } catch {
    // GET endpoint hatasi olsa bile POST denemesi yapmaya devam ederiz.
  }

  await kickApiRequest("/events/subscriptions", accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method: "webhook",
      events: [{ name: CHAT_MESSAGE_EVENT, version: 1 }],
    }),
  });
}

export async function getKickPublicKey(): Promise<string> {
  const envPublicKey = process.env.KICK_PUBLIC_KEY;
  if (envPublicKey) {
    return normalizePublicKey(envPublicKey);
  }

  if (cachedPublicKey && Date.now() < cachedPublicKeyExpiresAt) {
    return cachedPublicKey;
  }

  try {
    const response = await fetch(`${KICK_API_BASE}/public-key`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(await readKickError(response));
    }

    const payload = (await response.json()) as KickPublicKeyResponse;
    const publicKey = payload.data?.public_key;
    if (!publicKey) {
      throw new Error("Public key bos dondu.");
    }

    cachedPublicKey = normalizePublicKey(publicKey);
    cachedPublicKeyExpiresAt = Date.now() + 60 * 60 * 1000;
    return cachedPublicKey;
  } catch {
    return FALLBACK_KICK_PUBLIC_KEY;
  }
}

export async function verifyKickWebhookSignature(params: {
  messageId: string;
  timestamp: string;
  rawBody: string;
  signature: string;
}): Promise<boolean> {
  try {
    const publicKey = await getKickPublicKey();
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${params.messageId}.${params.timestamp}.${params.rawBody}`);
    verifier.end();

    return verifier.verify(publicKey, params.signature, "base64");
  } catch (error) {
    console.error("Webhook imza dogrulamasi basarisiz:", error);
    return false;
  }
}

export function parseChatMessageEvent(
  eventType: string,
  payload: unknown,
): KickChatEvent | null {
  if (eventType !== CHAT_MESSAGE_EVENT) {
    return null;
  }

  const root = asObject(payload);
  if (!root) {
    return null;
  }

  const broadcaster = asObject(root.broadcaster);
  const sender = asObject(root.sender);

  const broadcasterUserId = Number(
    broadcaster?.user_id ?? root.broadcaster_user_id ?? NaN,
  );

  const senderUsername =
    typeof sender?.username === "string" && sender.username.trim().length > 0
      ? sender.username.trim()
      : "isimsiz";

  const content =
    typeof root.content === "string" && root.content.trim().length > 0
      ? root.content.trim()
      : "(mesaj yok)";

  if (!Number.isFinite(broadcasterUserId) || broadcasterUserId <= 0) {
    return null;
  }

  const createdAtRaw = typeof root.created_at === "string" ? root.created_at : null;
  const createdAt = createdAtRaw ? Date.parse(createdAtRaw) : Date.now();

  return {
    broadcasterUserId,
    senderUsername,
    content,
    eventId:
      typeof root.message_id === "string" && root.message_id.length > 0
        ? root.message_id
        : `${broadcasterUserId}-${Date.now()}`,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  };
}
