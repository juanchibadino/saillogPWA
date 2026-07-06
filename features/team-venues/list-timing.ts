import "server-only"

export type TeamVenuesListTimingStatus = "success" | "error"

type TeamVenuesListTimingValue = string | number | boolean | null
type TeamVenuesListTimingMetadata = Record<
  string,
  TeamVenuesListTimingValue | undefined
>

type TeamVenuesListTimingInput = {
  activeTeamId?: string | null
  error?: string
  metadata?: TeamVenuesListTimingMetadata
  phase: string
  startedAt: number
  status: TeamVenuesListTimingStatus
}

export function startTeamVenuesListTiming(): number {
  return Date.now()
}

function cleanMetadata(
  metadata: TeamVenuesListTimingMetadata | undefined,
): Record<string, TeamVenuesListTimingValue> | undefined {
  if (!metadata) {
    return undefined
  }

  const entries = Object.entries(metadata).filter(
    (entry): entry is [string, TeamVenuesListTimingValue] =>
      typeof entry[1] !== "undefined",
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function formatTeamVenuesListTimingError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function logTeamVenuesListTiming(input: TeamVenuesListTimingInput): void {
  const payload = {
    level: input.status === "error" ? "error" : "info",
    msg: "team_venues_list_timing",
    route: "/team-venues",
    phase: input.phase,
    ms: Date.now() - input.startedAt,
    activeTeamId: input.activeTeamId ?? null,
    status: input.status,
    error: input.error,
    metadata: cleanMetadata(input.metadata),
  }

  console.log(JSON.stringify(payload))
}
