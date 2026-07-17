import { headers } from "next/headers";

import { getOptionalAppUrlOrigin } from "@/lib/supabase/env";

function getOriginIfValid(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export async function resolveRequestOrigin(request: Request): Promise<string> {
  const requestUrl = new URL(request.url);
  const requestOrigin = requestUrl.origin;
  const requestHost = requestUrl.hostname.toLowerCase();
  const isLocalHost =
    requestHost === "localhost" ||
    requestHost === "127.0.0.1" ||
    requestHost === "::1" ||
    requestHost.endsWith(".localhost");

  // Local requests must stay local regardless of runtime mode.
  if (isLocalHost) {
    return requestOrigin;
  }

  // In local/dev, always keep redirects on the current origin.
  if (process.env.NODE_ENV !== "production") {
    return requestOrigin;
  }

  const configuredAppOrigin = getOptionalAppUrlOrigin();
  if (configuredAppOrigin) {
    return configuredAppOrigin;
  }

  const headerStore = await headers();
  const originHeader = getOriginIfValid(headerStore.get("origin"));
  if (originHeader) {
    return originHeader;
  }

  const forwardedHost = headerStore.get("x-forwarded-host");
  const forwardedProto = headerStore.get("x-forwarded-proto") ?? "https";

  if (forwardedHost) {
    const forwardedOrigin = getOriginIfValid(`${forwardedProto}://${forwardedHost}`);
    if (forwardedOrigin) {
      return forwardedOrigin;
    }
  }

  return requestOrigin;
}

export async function resolveCurrentRequestOrigin(): Promise<string> {
  if (process.env.NODE_ENV === "production") {
    const configuredAppOrigin = getOptionalAppUrlOrigin();
    if (configuredAppOrigin) {
      return configuredAppOrigin;
    }
  }

  const headerStore = await headers();
  const originHeader = getOriginIfValid(headerStore.get("origin"));
  if (originHeader) {
    return originHeader;
  }

  const forwardedHost = headerStore.get("x-forwarded-host");
  const forwardedProto = headerStore.get("x-forwarded-proto") ?? "https";

  if (forwardedHost) {
    const forwardedOrigin = getOriginIfValid(`${forwardedProto}://${forwardedHost}`);
    if (forwardedOrigin) {
      return forwardedOrigin;
    }
  }

  const host = headerStore.get("host");
  if (host) {
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const hostOrigin = getOriginIfValid(`${protocol}://${host}`);
    if (hostOrigin) {
      return hostOrigin;
    }
  }

  const configuredAppOrigin = getOptionalAppUrlOrigin();
  if (configuredAppOrigin) {
    return configuredAppOrigin;
  }

  return "http://localhost:3000";
}

export async function buildRequestUrl(path: string, request: Request): Promise<URL> {
  const origin = await resolveRequestOrigin(request);
  return new URL(path, origin);
}
