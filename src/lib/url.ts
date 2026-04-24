import "server-only";

import { headers } from "next/headers";

import { env } from "@/lib/env";

export function getOriginFromRequestUrl(requestUrl: string): string {
  if (env.appUrl) {
    return env.appUrl;
  }

  const url = new URL(requestUrl);
  return `${url.protocol}//${url.host}`;
}

export async function getOriginFromHeaders(): Promise<string> {
  if (env.appUrl) {
    return env.appUrl;
  }

  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}
