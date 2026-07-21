import "server-only"

export type TeamAssetsTimingPhase = "chrome" | "results"
export type TeamAssetsTimingStatus = "success" | "error"

type TeamAssetsTimingValue = string | number | boolean | null
type TeamAssetsTimingMetadata = Record<
  string,
  TeamAssetsTimingValue | undefined
>

type TeamAssetsTimingInput = {
  activeTeamId?: string | null
  error?: string
  metadata?: TeamAssetsTimingMetadata
  phase: TeamAssetsTimingPhase
  startedAt: number
  status: TeamAssetsTimingStatus
}

export function startTeamAssetsTiming(): number {
  return Date.now()
}

function cleanMetadata(
  metadata: TeamAssetsTimingMetadata | undefined,
): Record<string, TeamAssetsTimingValue> | undefined {
  if (!metadata) {
    return undefined
  }

  const entries = Object.entries(metadata).filter(
    (entry): entry is [string, TeamAssetsTimingValue] =>
      typeof entry[1] !== "undefined",
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function formatTeamAssetsTimingError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function logTeamAssetsTiming(input: TeamAssetsTimingInput): void {
  const payload = {
    level: input.status === "error" ? "error" : "info",
    msg: "team_assets_timing",
    route: "/team-assets",
    phase: input.phase,
    ms: Date.now() - input.startedAt,
    activeTeamId: input.activeTeamId ?? null,
    status: input.status,
    error: input.error,
    metadata: cleanMetadata(input.metadata),
  }

  console.log(JSON.stringify(payload))
}
