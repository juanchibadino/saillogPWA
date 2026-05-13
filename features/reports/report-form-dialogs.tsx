"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { createTeamVenueReportAction } from "@/features/reports/actions"
import type { NavigationScope } from "@/lib/navigation/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export type ReportCampDialogOption = {
  campId: string
  name: string
  dateRangeLabel: string
}

export type TeamReportCreateVenueOption = {
  teamVenueId: string
  venueName: string
}

export type TeamReportCreateCampOption = ReportCampDialogOption & {
  teamVenueId: string
  year: number
}

export function CreateReportDialog({
  scope,
  teamVenueId,
  year,
  redirectTo,
  campOptions,
  disabled,
}: {
  scope: NavigationScope
  teamVenueId: string | null
  year: number
  redirectTo: string
  campOptions: ReportCampDialogOption[]
  disabled: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [reportName, setReportName] = React.useState("")
  const [selectedCampIds, setSelectedCampIds] = React.useState<string[]>([])

  const canChooseCamps = teamVenueId !== null && campOptions.length > 0
  const canSubmit = !disabled && canChooseCamps && selectedCampIds.length > 0

  function toggleCampSelection(campId: string): void {
    setSelectedCampIds((currentValue) =>
      currentValue.includes(campId)
        ? currentValue.filter((selectedId) => selectedId !== campId)
        : [...currentValue, campId],
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (nextOpen) {
          setReportName("")
          setSelectedCampIds([])
        }
      }}
    >
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}
      >
        <PlusIcon className="size-4" />
        New
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create report</DialogTitle>
          <DialogDescription>
            Select one or more camps for {year}. New reports are immutable records.
          </DialogDescription>
        </DialogHeader>

        <form action={createTeamVenueReportAction} className="space-y-4">
          <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
          ) : null}
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="year" value={String(year)} />
          <input type="hidden" name="teamVenueId" value={teamVenueId ?? ""} />

          <div className="space-y-2">
            <Label htmlFor="report-name">Report name (optional)</Label>
            <input
              id="report-name"
              name="reportName"
              maxLength={200}
              value={reportName}
              onChange={(event) => setReportName(event.target.value)}
              placeholder="Auto: Venue + year + camps"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Camps</legend>

            {!canChooseCamps ? (
              <p className="text-sm text-muted-foreground">
                {teamVenueId === null
                  ? "Select a venue first to load camps."
                  : "No camps available for the selected year and venue."}
              </p>
            ) : (
              <div className="grid gap-2">
                {campOptions.map((camp) => {
                  const isSelected = selectedCampIds.includes(camp.campId)

                  return (
                    <label
                      key={camp.campId}
                      className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="campIds"
                        value={camp.campId}
                        checked={isSelected}
                        onChange={() => toggleCampSelection(camp.campId)}
                        className="mt-1 size-4 rounded border-input"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{camp.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {camp.dateRangeLabel}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit}>
              Create report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CreateTeamReportDialog({
  scope,
  redirectTo,
  venueOptions,
  campOptions,
}: {
  scope: NavigationScope
  redirectTo: string
  venueOptions: TeamReportCreateVenueOption[]
  campOptions: TeamReportCreateCampOption[]
}) {
  const [open, setOpen] = React.useState(false)
  const currentUtcYear = new Date().getUTCFullYear()

  const yearOptions = React.useMemo(() => {
    const values = new Set<number>([currentUtcYear])

    for (const camp of campOptions) {
      values.add(camp.year)
    }

    return Array.from(values).sort((left, right) => right - left)
  }, [campOptions, currentUtcYear])

  const [selectedVenueId, setSelectedVenueId] = React.useState("")
  const [selectedYear, setSelectedYear] = React.useState<number>(yearOptions[0] ?? currentUtcYear)
  const [selectedCampIds, setSelectedCampIds] = React.useState<string[]>([])

  React.useEffect(() => {
    if (venueOptions.length > 0 && selectedVenueId.length === 0) {
      setSelectedVenueId(venueOptions[0].teamVenueId)
    }
  }, [selectedVenueId, venueOptions])

  React.useEffect(() => {
    if (!yearOptions.includes(selectedYear)) {
      setSelectedYear(yearOptions[0] ?? currentUtcYear)
    }
  }, [currentUtcYear, selectedYear, yearOptions])

  const filteredCampOptions = React.useMemo(
    () =>
      campOptions.filter(
        (camp) => camp.teamVenueId === selectedVenueId && camp.year === selectedYear,
      ),
    [campOptions, selectedVenueId, selectedYear],
  )

  React.useEffect(() => {
    const visibleCampIds = new Set(filteredCampOptions.map((camp) => camp.campId))

    setSelectedCampIds((currentValue) =>
      currentValue.filter((campId) => visibleCampIds.has(campId)),
    )
  }, [filteredCampOptions])

  function resetDraft(): void {
    setSelectedVenueId(venueOptions[0]?.teamVenueId ?? "")
    setSelectedYear(yearOptions[0] ?? currentUtcYear)
    setSelectedCampIds([])
  }

  function toggleCampSelection(campId: string): void {
    setSelectedCampIds((currentValue) =>
      currentValue.includes(campId)
        ? currentValue.filter((selectedId) => selectedId !== campId)
        : [...currentValue, campId],
    )
  }

  const canSubmit =
    selectedVenueId.length > 0 &&
    Number.isFinite(selectedYear) &&
    selectedCampIds.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (nextOpen) {
          resetDraft()
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <PlusIcon className="size-4" />
        New
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create report</DialogTitle>
          <DialogDescription>
            Select venue, year, and camps to create a new report.
          </DialogDescription>
        </DialogHeader>

        <form action={createTeamVenueReportAction} className="space-y-4">
          <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
          ) : null}
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <div className="space-y-2">
            <Label htmlFor="team-report-dialog-venue">Venue</Label>
            <select
              id="team-report-dialog-venue"
              name="teamVenueId"
              value={selectedVenueId}
              onChange={(event) => setSelectedVenueId(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {venueOptions.map((venueOption) => (
                <option key={venueOption.teamVenueId} value={venueOption.teamVenueId}>
                  {venueOption.venueName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-report-dialog-year">Year</Label>
            <select
              id="team-report-dialog-year"
              name="year"
              value={String(selectedYear)}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10)
                if (Number.isFinite(parsed)) {
                  setSelectedYear(parsed)
                }
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {yearOptions.map((yearOption) => (
                <option key={yearOption} value={String(yearOption)}>
                  {yearOption}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Camps</legend>

            {filteredCampOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No camps available for this venue and year.
              </p>
            ) : (
              <div className="grid gap-2">
                {filteredCampOptions.map((camp) => {
                  const isSelected = selectedCampIds.includes(camp.campId)

                  return (
                    <label
                      key={camp.campId}
                      className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="campIds"
                        value={camp.campId}
                        checked={isSelected}
                        onChange={() => toggleCampSelection(camp.campId)}
                        className="mt-1 size-4 rounded border-input"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{camp.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {camp.dateRangeLabel}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
