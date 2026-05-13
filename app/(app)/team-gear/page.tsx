import { CreateGearDialog } from "@/features/gear/gear-form-dialogs"
import { GearFeedback } from "@/features/gear/gear-feedback"
import { TeamGearTable } from "@/features/gear/gear-table"
import { TeamGearToolbar } from "@/features/gear/team-gear-toolbar"
import {
  getTeamGearPageData,
} from "@/features/gear/data"
import {
  TEAM_GEAR_ALERT_STATE_OPTIONS,
  TEAM_GEAR_CONDITION_OPTIONS,
  TEAM_GEAR_STATUS_OPTIONS,
  TEAM_GEAR_TYPE_OPTIONS,
  type TeamGearListItem,
} from "@/features/gear/shared"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageTeamSessions } from "@/lib/auth/capabilities"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type TeamGearSearchParams = Promise<Record<string, string | string[] | undefined>>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "created") {
    return "Gear item created successfully."
  }

  if (status === "updated") {
    return "Gear item updated successfully."
  }

  if (status === "retired") {
    return "Gear item marked as retired/spare."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted gear data is invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to manage gear for this team."
  }

  if (error === "create_failed") {
    return "Could not create gear item. Confirm your permissions and try again."
  }

  if (error === "update_failed") {
    return "Could not update gear item. Confirm your permissions and try again."
  }

  return null
}

function parseRequestedPage(value: string | undefined): number {
  if (!value) {
    return 1
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return Math.floor(parsed)
}

function buildTeamGearFiltersHref(input: {
  scope: {
    activeOrgId: string
    activeTeamId: string | null
  }
  type?: string
  statusFilter?: string
  condition?: string
  alert?: string
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (input.type) {
    params.set("type", input.type)
  }

  if (input.statusFilter) {
    params.set("statusFilter", input.statusFilter)
  }

  if (input.condition) {
    params.set("condition", input.condition)
  }

  if (input.alert) {
    params.set("alert", input.alert)
  }

  return `/team-gear?${params.toString()}`
}

export default async function TeamGearPage({
  searchParams,
}: {
  searchParams: TeamGearSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams

  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const requestedType = getSingleSearchParamValue(resolvedSearchParams.type)
  const requestedStatusFilter = getSingleSearchParamValue(resolvedSearchParams.statusFilter)
  const requestedCondition = getSingleSearchParamValue(resolvedSearchParams.condition)
  const requestedAlert = getSingleSearchParamValue(resolvedSearchParams.alert)
  const requestedPage = parseRequestedPage(
    getSingleSearchParamValue(resolvedSearchParams.page),
  )

  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Team gear unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          No active organization context is available for this account.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const noTeamSelected = scope.activeTeamId === null
  const activeTeamId = scope.activeTeamId

  const canManageGear =
    activeTeamId !== null &&
    canManageTeamSessions({
      context,
      organizationId: scope.activeOrgId,
      teamId: activeTeamId,
    })

  let gearItems: TeamGearListItem[] = []
  let selectedType: string | undefined = requestedType
  let selectedStatusFilter: string | undefined = requestedStatusFilter
  let selectedCondition: string | undefined = requestedCondition
  let selectedAlert: string | undefined = requestedAlert
  let currentPage = requestedPage
  let hasPreviousPage = requestedPage > 1
  let hasNextPage = false

  if (activeTeamId) {
    const pageData = await getTeamGearPageData({
      activeTeamId,
      selectedType: requestedType,
      selectedStatus: requestedStatusFilter,
      selectedCondition: requestedCondition,
      selectedAlertState: requestedAlert,
      page: requestedPage,
    })

    gearItems = pageData.gearItems
    selectedType = pageData.selectedType
    selectedStatusFilter = pageData.selectedStatus
    selectedCondition = pageData.selectedCondition
    selectedAlert = pageData.selectedAlertState
    currentPage = pageData.currentPage
    hasPreviousPage = pageData.hasPreviousPage
    hasNextPage = pageData.hasNextPage
  }

  const createDisabled = noTeamSelected || !canManageGear

  return (
    <div className="space-y-6">
      <GearFeedback statusMessage={statusMessage} errorMessage={errorMessage} />

      {noTeamSelected ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Team selection required</h2>
          <p className="mt-2 text-sm text-amber-800">
            Team modules are disabled until a team is selected in the scope picker.
          </p>
        </section>
      ) : null}

      {!noTeamSelected && !canManageGear ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view gear in this scope, but only super admins, organization admins,
            team admins, coaches, and crew can create or edit gear items.
          </p>
        </section>
      ) : null}

      <TeamGearTable
        gearItems={gearItems}
        canManageGear={canManageGear}
        noTeamSelected={noTeamSelected}
        toolbar={
          <TeamGearToolbar
            selectedType={selectedType ?? ""}
            selectedStatus={selectedStatusFilter ?? ""}
            selectedCondition={selectedCondition ?? ""}
            selectedAlert={selectedAlert ?? ""}
            disabled={noTeamSelected}
            typeOptions={[
              {
                value: "",
                label: "All",
                href: buildTeamGearFiltersHref({
                  scope,
                  statusFilter: selectedStatusFilter,
                  condition: selectedCondition,
                  alert: selectedAlert,
                }),
              },
              ...TEAM_GEAR_TYPE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                href: buildTeamGearFiltersHref({
                  scope,
                  type: option.value,
                  statusFilter: selectedStatusFilter,
                  condition: selectedCondition,
                  alert: selectedAlert,
                }),
              })),
            ]}
            statusOptions={[
              {
                value: "",
                label: "All",
                href: buildTeamGearFiltersHref({
                  scope,
                  type: selectedType,
                  condition: selectedCondition,
                  alert: selectedAlert,
                }),
              },
              ...TEAM_GEAR_STATUS_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                href: buildTeamGearFiltersHref({
                  scope,
                  type: selectedType,
                  statusFilter: option.value,
                  condition: selectedCondition,
                  alert: selectedAlert,
                }),
              })),
            ]}
            conditionOptions={[
              {
                value: "",
                label: "All",
                href: buildTeamGearFiltersHref({
                  scope,
                  type: selectedType,
                  statusFilter: selectedStatusFilter,
                  alert: selectedAlert,
                }),
              },
              ...TEAM_GEAR_CONDITION_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                href: buildTeamGearFiltersHref({
                  scope,
                  type: selectedType,
                  statusFilter: selectedStatusFilter,
                  condition: option.value,
                  alert: selectedAlert,
                }),
              })),
            ]}
            alertOptions={[
              {
                value: "",
                label: "All",
                href: buildTeamGearFiltersHref({
                  scope,
                  type: selectedType,
                  statusFilter: selectedStatusFilter,
                  condition: selectedCondition,
                }),
              },
              ...TEAM_GEAR_ALERT_STATE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                href: buildTeamGearFiltersHref({
                  scope,
                  type: selectedType,
                  statusFilter: selectedStatusFilter,
                  condition: selectedCondition,
                  alert: option.value,
                }),
              })),
            ]}
            action={
              <CreateGearDialog
                scope={scope}
                selectedType={selectedType}
                selectedStatusFilter={selectedStatusFilter}
                selectedCondition={selectedCondition}
                selectedAlert={selectedAlert}
                currentPage={currentPage}
                gearTypeOptions={TEAM_GEAR_TYPE_OPTIONS}
                gearStatusOptions={TEAM_GEAR_STATUS_OPTIONS}
                gearConditionOptions={TEAM_GEAR_CONDITION_OPTIONS}
                disabled={createDisabled}
              />
            }
          />
        }
        scope={scope}
        selectedType={selectedType}
        selectedStatusFilter={selectedStatusFilter}
        selectedCondition={selectedCondition}
        selectedAlert={selectedAlert}
        currentPage={currentPage}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
      />
    </div>
  )
}
