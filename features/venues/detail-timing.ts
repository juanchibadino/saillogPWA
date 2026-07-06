import "server-only";

export type VenueDetailTimingStatus = "success" | "error";

type VenueDetailTimingValue = string | number | boolean | null;
type VenueDetailTimingMetadata = Record<
  string,
  VenueDetailTimingValue | undefined
>;

type VenueDetailTimingInput = {
  activeTeamId?: string | null;
  error?: string;
  metadata?: VenueDetailTimingMetadata;
  phase: string;
  route: string;
  startedAt: number;
  status: VenueDetailTimingStatus;
  teamVenueId?: string | null;
};

export function startVenueDetailTiming(): number {
  return Date.now();
}

export function getVenueDetailTimingErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown error";
}

function cleanMetadata(
  metadata: VenueDetailTimingMetadata | undefined,
): Record<string, VenueDetailTimingValue> | undefined {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata).filter(
    (entry): entry is [string, VenueDetailTimingValue] =>
      typeof entry[1] !== "undefined",
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function logVenueDetailTiming(input: VenueDetailTimingInput): void {
  const payload = {
    level: input.status === "error" ? "error" : "info",
    msg: "team_venue_timing",
    route: input.route,
    phase: input.phase,
    ms: Date.now() - input.startedAt,
    teamVenueId: input.teamVenueId ?? null,
    activeTeamId: input.activeTeamId ?? null,
    status: input.status,
    error: input.error,
    metadata: cleanMetadata(input.metadata),
  };

  console.log(JSON.stringify(payload));
}
