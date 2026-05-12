"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamStructure } from "@/lib/auth/capabilities"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import { createTeamVenueReportInputSchema } from "@/lib/validation/reports"
import { buildDefaultReportName, isCampYear } from "@/features/reports/data"

type CreateReportError = "invalid_input" | "forbidden" | "create_failed"

type CreateReportStatus = "report_created"

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function getFormStringArray(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0)
}

function buildReportRedirectPath(input: {
  redirectTo: string
  status?: CreateReportStatus
  error?: CreateReportError
}): string {
  const url = new URL(input.redirectTo, "http://localhost")

  if (input.status) {
    url.searchParams.set("status", input.status)
    url.searchParams.delete("error")
  }

  if (input.error) {
    url.searchParams.set("error", input.error)
    url.searchParams.delete("status")
  }

  const query = url.searchParams.toString()
  return query.length > 0 ? `${url.pathname}?${query}` : url.pathname
}

export async function createTeamVenueReportAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedAccessContext()

  const scope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })

  const redirectTo = getFormString(formData, "redirectTo")

  if (!scope.success || !redirectTo) {
    redirect("/team-reports?error=invalid_input")
  }

  if (!scope.data.scopeOrgId || !scope.data.scopeTeamId) {
    redirect(
      buildReportRedirectPath({
        redirectTo,
        error: "invalid_input",
      }),
    )
  }

  const parsedInput = createTeamVenueReportInputSchema.safeParse({
    teamVenueId: getFormString(formData, "teamVenueId"),
    year: getFormString(formData, "year"),
    reportName: getFormString(formData, "reportName"),
    campIds: getFormStringArray(formData, "campIds"),
    redirectTo,
  })

  if (!parsedInput.success) {
    redirect(
      buildReportRedirectPath({
        redirectTo,
        error: "invalid_input",
      }),
    )
  }

  if (
    !canManageTeamStructure({
      context,
      organizationId: scope.data.scopeOrgId,
      teamId: scope.data.scopeTeamId,
    })
  ) {
    redirect(
      buildReportRedirectPath({
        redirectTo: parsedInput.data.redirectTo,
        error: "forbidden",
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: teamVenue, error: teamVenueError } = await supabase
    .from("team_venues")
    .select("id,team_id,venue_id")
    .eq("id", parsedInput.data.teamVenueId)
    .maybeSingle()

  if (teamVenueError || !teamVenue || teamVenue.team_id !== scope.data.scopeTeamId) {
    redirect(
      buildReportRedirectPath({
        redirectTo: parsedInput.data.redirectTo,
        error: "forbidden",
      }),
    )
  }

  const { data: campRows, error: campsError } = await supabase
    .from("camps")
    .select("id,name,start_date,team_venue_id")
    .in("id", parsedInput.data.campIds)

  if (campsError || !campRows || campRows.length !== parsedInput.data.campIds.length) {
    redirect(
      buildReportRedirectPath({
        redirectTo: parsedInput.data.redirectTo,
        error: "invalid_input",
      }),
    )
  }

  const invalidScope = campRows.some(
    (camp) =>
      camp.team_venue_id !== parsedInput.data.teamVenueId ||
      !isCampYear(camp.start_date, parsedInput.data.year),
  )

  if (invalidScope) {
    redirect(
      buildReportRedirectPath({
        redirectTo: parsedInput.data.redirectTo,
        error: "invalid_input",
      }),
    )
  }

  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("id,name")
    .eq("id", teamVenue.venue_id)
    .maybeSingle()

  if (venueError || !venue) {
    redirect(
      buildReportRedirectPath({
        redirectTo: parsedInput.data.redirectTo,
        error: "create_failed",
      }),
    )
  }

  const sortedCampRows = [...campRows].sort((left, right) => {
    const dateOrder = left.start_date.localeCompare(right.start_date)

    if (dateOrder !== 0) {
      return dateOrder
    }

    return left.name.localeCompare(right.name)
  })

  const reportNameInput = parsedInput.data.reportName?.trim()
  const reportName =
    reportNameInput && reportNameInput.length > 0
      ? reportNameInput
      : buildDefaultReportName({
          venueName: venue.name,
          year: parsedInput.data.year,
          campNames: sortedCampRows.map((camp) => camp.name),
        })

  const { data: createdReport, error: createReportError } = await supabase
    .from("team_venue_reports")
    .insert({
      team_venue_id: parsedInput.data.teamVenueId,
      year: parsedInput.data.year,
      name: reportName,
      created_by_profile_id: context.profile?.id ?? null,
    })
    .select("id")
    .single()

  if (createReportError || !createdReport) {
    redirect(
      buildReportRedirectPath({
        redirectTo: parsedInput.data.redirectTo,
        error: "create_failed",
      }),
    )
  }

  const { error: createReportCampsError } = await supabase
    .from("team_venue_report_camps")
    .insert(
      sortedCampRows.map((camp) => ({
        report_id: createdReport.id,
        camp_id: camp.id,
      })),
    )

  if (createReportCampsError) {
    await supabase.from("team_venue_reports").delete().eq("id", createdReport.id)

    redirect(
      buildReportRedirectPath({
        redirectTo: parsedInput.data.redirectTo,
        error: "create_failed",
      }),
    )
  }

  revalidatePath("/team-reports")
  revalidatePath("/reports")
  revalidatePath("/venues")
  revalidatePath(`/venues/${parsedInput.data.teamVenueId}`)

  redirect(
    buildReportRedirectPath({
      redirectTo: parsedInput.data.redirectTo,
      status: "report_created",
    }),
  )
}
