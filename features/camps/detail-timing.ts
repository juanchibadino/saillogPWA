import "server-only"

export type CampDetailTimingStatus = "success" | "error"

type CampDetailTimingValue = string | number | boolean | null
type CampDetailTimingMetadata = Record<
  string,
  CampDetailTimingValue | undefined
>

type CampDetailTimingInput = {
  activeTeamId?: string | null
  campId?: string | null
  error?: string
  metadata?: CampDetailTimingMetadata
  phase: string
  route: string
  startedAt: number
  status: CampDetailTimingStatus
}

export function startCampDetailTiming(): number {
  return Date.now()
}

export function getCampDetailTimingErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return typeof error === "string" ? error : "Unknown error"
}

function cleanMetadata(
  metadata: CampDetailTimingMetadata | undefined,
): Record<string, CampDetailTimingValue> | undefined {
  if (!metadata) {
    return undefined
  }

  const entries = Object.entries(metadata).filter(
    (entry): entry is [string, CampDetailTimingValue] =>
      typeof entry[1] !== "undefined",
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function logCampDetailTiming(input: CampDetailTimingInput): void {
  const payload = {
    level: input.status === "error" ? "error" : "info",
    msg: "team_camp_timing",
    route: input.route,
    phase: input.phase,
    ms: Date.now() - input.startedAt,
    campId: input.campId ?? null,
    activeTeamId: input.activeTeamId ?? null,
    status: input.status,
    error: input.error,
    metadata: cleanMetadata(input.metadata),
  }

  console.log(JSON.stringify(payload))
}
