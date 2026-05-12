const LEGACY_ASSESSMENT_MODE_LABELS: Record<string, string> = {
  single_trap: "Single Trap",
  double_trap: "Double Trap",
  full_power: "Full Power",
  depower: "Depower",
};

export type AssessmentWindMode = string;

function humanizeModeLabel(value: string): string {
  const normalized = value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized.length === 0) {
    return value;
  }

  return normalized
    .split(" ")
    .map((token) =>
      token.length > 0
        ? `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`
        : token,
    )
    .join(" ");
}

export function formatAssessmentWindModeLabel(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return value;
  }

  const legacyLabel = LEGACY_ASSESSMENT_MODE_LABELS[trimmed.toLowerCase()];

  if (legacyLabel) {
    return legacyLabel;
  }

  if (/^[a-z0-9_\-\s]+$/i.test(trimmed)) {
    return humanizeModeLabel(trimmed);
  }

  return trimmed;
}
