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

  return new URL(request.url).origin;
}

export async function buildRequestUrl(path: string, request: Request): Promise<URL> {
  const origin = await resolveRequestOrigin(request);
  return new URL(path, origin);
}
