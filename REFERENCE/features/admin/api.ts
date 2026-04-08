"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const ADMIN_REQUEST_TIMEOUT_MS = 12000;

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ADMIN_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(path, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        "Tiempo de espera agotado al contactar al servidor. Revisa la conexion con Supabase.",
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function getAdminHeaders(withJson: boolean) {
  const headers: Record<string, string> = withJson
    ? { "Content-Type": "application/json" }
    : {};

  const adminKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY;

  if (adminKey) {
    headers["x-admin-key"] = adminKey;
  }

  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function throwFromResponse(response: Response): Promise<never> {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (response.status === 401 && typeof window !== "undefined") {
    window.location.href = "/admin/login";
  }

  throw new Error(payload?.error ?? `Request failed: ${response.status}`);
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetchWithTimeout(path, {
    method: "GET",
    cache: "no-store",
    headers: await getAdminHeaders(false),
  });

  if (!response.ok) {
    await throwFromResponse(response);
  }

  return (await response.json()) as T;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetchWithTimeout(path, {
    method: "POST",
    headers: await getAdminHeaders(true),
    body: JSON.stringify(body ?? {}),
  });

  if (!response.ok) {
    await throwFromResponse(response);
  }

  return (await response.json()) as T;
}

export async function apiPatch<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetchWithTimeout(path, {
    method: "PATCH",
    headers: await getAdminHeaders(true),
    body: JSON.stringify(body ?? {}),
  });

  if (!response.ok) {
    await throwFromResponse(response);
  }

  return (await response.json()) as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetchWithTimeout(path, {
    method: "DELETE",
    headers: await getAdminHeaders(false),
  });

  if (!response.ok) {
    await throwFromResponse(response);
  }

  return (await response.json()) as T;
}
