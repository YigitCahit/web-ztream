import { NextRequest, NextResponse } from "next/server";

import { parseChatMessageEvent, verifyKickWebhookSignature } from "@/lib/kick";
import { keys } from "@/lib/keys";
import { getUserProfileById, pushOverlayEvent } from "@/lib/profile";
import { setIfAbsent } from "@/lib/store";

export const runtime = "nodejs";

const WEBHOOK_MESSAGE_TTL_SECONDS = 60 * 60 * 24;

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, message: "Kick webhook endpoint hazir." });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const messageId = request.headers.get("kick-event-message-id");
  const timestamp = request.headers.get("kick-event-message-timestamp");
  const signature = request.headers.get("kick-event-signature");
  const eventType = request.headers.get("kick-event-type") ?? "";

  if (!messageId || !timestamp || !signature) {
    return NextResponse.json(
      { ok: false, error: "Eksik webhook header." },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  const signatureOk = await verifyKickWebhookSignature({
    messageId,
    timestamp,
    signature,
    rawBody,
  });

  if (!signatureOk) {
    return NextResponse.json(
      { ok: false, error: "Webhook imzasi gecersiz." },
      { status: 401 },
    );
  }

  const firstTime = await setIfAbsent(
    keys.webhookMessage(messageId),
    "1",
    WEBHOOK_MESSAGE_TTL_SECONDS,
  );

  if (!firstTime) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Webhook body JSON degil." },
      { status: 400 },
    );
  }

  const parsedChatEvent = parseChatMessageEvent(eventType, payload);
  if (!parsedChatEvent) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  const targetProfile = await getUserProfileById(parsedChatEvent.broadcasterUserId);
  if (!targetProfile) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  await pushOverlayEvent(targetProfile.userId, {
    id: `${messageId}-${parsedChatEvent.eventId}`,
    senderUsername: parsedChatEvent.senderUsername,
    content: parsedChatEvent.content,
    createdAt: parsedChatEvent.createdAt,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
