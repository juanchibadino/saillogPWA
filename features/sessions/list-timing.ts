import "server-only"

export type TeamSessionsListTimingStatus = "success" | "error"

type TeamSessionsListTimingValue = string | number | boolean | null
type TeamSessionsListTimingMetadata = Record<
  string,
  TeamSessionsListTimingValue | undefined
>

type TeamSessionsListTimingInput = {
  activeTeamId?: string | null
  error?: string
  metadata?: TeamSessionsListTimingMetadata
  phase: string
  startedAt: number
  status: TeamSessionsListTimingStatus
}

export function startTeamSessionsListTiming(): number {
  return Date.now()
}

function cleanMetadata(
  metadata: TeamSessionsListTimingMetadata | undefined,
): Record<string, TeamSessionsListTimingValue> | undefined {
  if (!metadata) {
    return undefined
  }

  const entries = Object.entries(metadata).filter(
    (entry): entry is [string, TeamSessionsListTimingValue] =>
      typeof entry[1] !== "undefined",
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function logTeamSessionsListTiming(
  input: TeamSessionsListTimingInput,
): void {
  const payload = {
    level: input.status === "error" ? "error" : "info",
    msg: "team_sessions_list_timing",
    route: "/team-sessions",
    phase: input.phase,
    ms: Date.now() - input.startedAt,
    activeTeamId: input.activeTeamId ?? null,
    status: input.status,
    error: input.error,
    metadata: cleanMetadata(input.metadata),
  }

  console.log(JSON.stringify(payload))
}
