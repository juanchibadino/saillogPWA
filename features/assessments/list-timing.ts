import "server-only"

export type TeamAssessmentsListTimingStatus = "success" | "error"

type TeamAssessmentsListTimingValue = string | number | boolean | null
type TeamAssessmentsListTimingMetadata = Record<
  string,
  TeamAssessmentsListTimingValue | undefined
>

type TeamAssessmentsListTimingInput = {
  activeTeamId?: string | null
  error?: string
  metadata?: TeamAssessmentsListTimingMetadata
  phase: string
  startedAt: number
  status: TeamAssessmentsListTimingStatus
}

export function startTeamAssessmentsListTiming(): number {
  return Date.now()
}

function cleanMetadata(
  metadata: TeamAssessmentsListTimingMetadata | undefined,
): Record<string, TeamAssessmentsListTimingValue> | undefined {
  if (!metadata) {
    return undefined
  }

  const entries = Object.entries(metadata).filter(
    (entry): entry is [string, TeamAssessmentsListTimingValue] =>
      typeof entry[1] !== "undefined",
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function formatTeamAssessmentsListTimingError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function logTeamAssessmentsListTiming(
  input: TeamAssessmentsListTimingInput,
): void {
  const payload = {
    level: input.status === "error" ? "error" : "info",
    msg: "team_assessments_list_timing",
    route: "/team-assessments",
    phase: input.phase,
    ms: Date.now() - input.startedAt,
    activeTeamId: input.activeTeamId ?? null,
    status: input.status,
    error: input.error,
    metadata: cleanMetadata(input.metadata),
  }

  console.log(JSON.stringify(payload))
}
