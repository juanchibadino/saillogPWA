import "server-only"

export type TeamHomeTimingPhase =
  | "scope"
  | "latest_sessions"
  | "latest_camps"
  | "latest_venues"
  | "team_members"
  | "kpis"

export type TeamHomeTimingStatus = "success" | "error"

type TeamHomeTimingValue = string | number | boolean | null
export type TeamHomeTimingMetadata = Record<
  string,
  TeamHomeTimingValue | undefined
>

type TeamHomeTimingInput = {
  activeOrgId?: string | null
  activeTeamId?: string | null
  error?: string
  metadata?: TeamHomeTimingMetadata
  phase: TeamHomeTimingPhase
  startedAt: number
  status: TeamHomeTimingStatus
}

export function startTeamHomeTiming(): number {
  return Date.now()
}

function cleanMetadata(
  metadata: TeamHomeTimingMetadata | undefined,
): Record<string, TeamHomeTimingValue> | undefined {
  if (!metadata) {
    return undefined
  }

  const entries = Object.entries(metadata).filter(
    (entry): entry is [string, TeamHomeTimingValue] =>
      typeof entry[1] !== "undefined",
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function formatTeamHomeTimingError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function logTeamHomeTiming(input: TeamHomeTimingInput): void {
  const payload = {
    level: input.status === "error" ? "error" : "info",
    msg: "team_home_timing",
    route: "/team-home",
    phase: input.phase,
    ms: Date.now() - input.startedAt,
    activeOrgId: input.activeOrgId ?? null,
    activeTeamId: input.activeTeamId ?? null,
    status: input.status,
    error: input.error,
    metadata: cleanMetadata(input.metadata),
  }

  console.log(JSON.stringify(payload))
}
