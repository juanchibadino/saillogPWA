import "server-only"

export type TeamCampsListTimingStatus = "success" | "error"

type TeamCampsListTimingValue = string | number | boolean | null
type TeamCampsListTimingMetadata = Record<
  string,
  TeamCampsListTimingValue | undefined
>

type TeamCampsListTimingInput = {
  activeTeamId?: string | null
  error?: string
  metadata?: TeamCampsListTimingMetadata
  phase: string
  startedAt: number
  status: TeamCampsListTimingStatus
}

export function startTeamCampsListTiming(): number {
  return Date.now()
}

function cleanMetadata(
  metadata: TeamCampsListTimingMetadata | undefined,
): Record<string, TeamCampsListTimingValue> | undefined {
  if (!metadata) {
    return undefined
  }

  const entries = Object.entries(metadata).filter(
    (entry): entry is [string, TeamCampsListTimingValue] =>
      typeof entry[1] !== "undefined",
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function logTeamCampsListTiming(input: TeamCampsListTimingInput): void {
  const payload = {
    level: input.status === "error" ? "error" : "info",
    msg: "team_camps_list_timing",
    route: "/team-camps",
    phase: input.phase,
    ms: Date.now() - input.startedAt,
    activeTeamId: input.activeTeamId ?? null,
    status: input.status,
    error: input.error,
    metadata: cleanMetadata(input.metadata),
  }

  console.log(JSON.stringify(payload))
}
