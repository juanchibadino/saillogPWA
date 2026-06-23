import "server-only"

export type SessionDetailTimingStatus = "success" | "error"

type SessionDetailTimingValue = string | number | boolean | null
type SessionDetailTimingMetadata = Record<
  string,
  SessionDetailTimingValue | undefined
>

type SessionDetailTimingInput = {
  activeTeamId?: string | null
  error?: string
  metadata?: SessionDetailTimingMetadata
  phase: string
  route: string
  sessionId?: string | null
  startedAt: number
  status: SessionDetailTimingStatus
}

export function startSessionDetailTiming(): number {
  return Date.now()
}

export function getSessionDetailTimingErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return typeof error === "string" ? error : "Unknown error"
}

export function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("digest" in error)) {
    return false
  }

  const digest = (error as { digest?: unknown }).digest
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")
}

function cleanMetadata(
  metadata: SessionDetailTimingMetadata | undefined,
): Record<string, SessionDetailTimingValue> | undefined {
  if (!metadata) {
    return undefined
  }

  const entries = Object.entries(metadata).filter(
    (entry): entry is [string, SessionDetailTimingValue] =>
      typeof entry[1] !== "undefined",
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function logSessionDetailTiming(input: SessionDetailTimingInput): void {
  const payload = {
    level: input.status === "error" ? "error" : "info",
    msg: "team_session_timing",
    route: input.route,
    phase: input.phase,
    ms: Date.now() - input.startedAt,
    sessionId: input.sessionId ?? null,
    activeTeamId: input.activeTeamId ?? null,
    status: input.status,
    error: input.error,
    metadata: cleanMetadata(input.metadata),
  }

  console.log(JSON.stringify(payload))
}
