export const POST_AUTH_PATH = "/post-auth"

export function normalizeSafeNextPath(value, fallback = POST_AUTH_PATH) {
  if (typeof value !== "string") {
    return fallback
  }

  const trimmed = value.trim()

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback
  }

  try {
    const parsed = new URL(trimmed, "https://dockout.local")

    if (parsed.origin !== "https://dockout.local") {
      return fallback
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

export function appendSafeNextParam(path, nextPath) {
  const safeNextPath = normalizeSafeNextPath(nextPath)

  if (safeNextPath === POST_AUTH_PATH) {
    return path
  }

  const url = new URL(path, "https://dockout.local")
  url.searchParams.set("next", safeNextPath)

  return `${url.pathname}${url.search}`
}
