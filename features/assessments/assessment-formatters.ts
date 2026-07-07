import type { TeamAssessmentRun } from "@/features/assessments/data"

export function getAssessmentRunStatusBadgeVariant(
  status: TeamAssessmentRun["status"],
): "secondary" | "default" | "outline" {
  if (status === "published") {
    return "default"
  }

  if (status === "closed") {
    return "secondary"
  }

  return "outline"
}

export function formatAssessmentRunStatusLabel(
  status: TeamAssessmentRun["status"],
): string {
  if (status === "published") {
    return "Published"
  }

  if (status === "closed") {
    return "Completed"
  }

  return "Draft"
}

export function formatDateTimeLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
