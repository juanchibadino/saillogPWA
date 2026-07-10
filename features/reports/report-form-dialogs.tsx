"use client"

import * as React from "react"
import { Loader2Icon, PlusIcon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { createTeamVenueReportAction } from "@/features/reports/actions"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

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

type ReportFormSurface = "drawer" | "sheet"

function ReportDialogFieldset({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <fieldset
      disabled={pending}
      className={cn(
        "space-y-4 disabled:pointer-events-none disabled:opacity-70",
        className,
      )}
    >
      {children}
    </fieldset>
  )
}

function ReportDialogSubmitButton({
  canSubmit,
  className,
  pendingLabel,
  submitLabel,
}: {
  canSubmit: boolean
  className?: string
  pendingLabel: string
  submitLabel: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={!canSubmit || pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        submitLabel
      )}
    </Button>
  )
}

function ReportDialogFooter({
  canSubmit,
  pendingLabel,
  submitLabel,
  surface,
}: {
  canSubmit: boolean
  pendingLabel: string
  submitLabel: string
  surface: ReportFormSurface
}) {
  const button = (
    <ReportDialogSubmitButton
      canSubmit={canSubmit}
      pendingLabel={pendingLabel}
      submitLabel={submitLabel}
      className={surface === "drawer" ? "h-11 w-full" : undefined}
    />
  )

  if (surface === "drawer") {
    return <DrawerFooter className="shrink-0 border-t">{button}</DrawerFooter>
  }

  return (
    <SheetFooter className="shrink-0 border-t sm:justify-end">
      {button}
    </SheetFooter>
  )
}

function ReportDialogForm({
  campOptions,
  canChooseCamps,
  canSubmit,
  idPrefix,
  onToggleCampSelection,
  redirectTo,
  reportName,
  scope,
  selectedCampIds,
  setReportName,
  surface,
  teamVenueId,
  year,
}: {
  campOptions: ReportCampDialogOption[]
  canChooseCamps: boolean
  canSubmit: boolean
  idPrefix: string
  onToggleCampSelection: (campId: string) => void
  redirectTo: string
  reportName: string
  scope: NavigationScope
  selectedCampIds: string[]
  setReportName: (value: string) => void
  surface: ReportFormSurface
  teamVenueId: string | null
  year: number
}) {
  const isDrawerSurface = surface === "drawer"

  return (
    <form
      action={createTeamVenueReportAction}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="year" value={String(year)} />
      <input type="hidden" name="teamVenueId" value={teamVenueId ?? ""} />

      <ReportDialogFieldset
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>Report name (optional)</Label>
          <input
            id={`${idPrefix}-name`}
            name="reportName"
            maxLength={200}
            value={reportName}
            onChange={(event) => setReportName(event.target.value)}
            placeholder="Auto: Venue + year + camps"
            className={
              isDrawerSurface
                ? "flex h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-base md:text-sm"
                : "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            }
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
                      onChange={() => onToggleCampSelection(camp.campId)}
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
      </ReportDialogFieldset>

      <ReportDialogFooter
        canSubmit={canSubmit}
        pendingLabel="Creating..."
        submitLabel="Create report"
        surface={surface}
      />
    </form>
  )
}

export function CreateReportDialog({
  scope,
  teamVenueId,
  year,
  redirectTo,
  campOptions,
  disabled,
  surface = "sheet",
  triggerVariant = "default",
}: {
  scope: NavigationScope
  teamVenueId: string | null
  year: number
  redirectTo: string
  campOptions: ReportCampDialogOption[]
  disabled: boolean
  surface?: ReportFormSurface
  triggerVariant?: "default" | "fab"
}) {
  const [open, setOpen] = React.useState(false)
  const [reportName, setReportName] = React.useState("")
  const [selectedCampIds, setSelectedCampIds] = React.useState<string[]>([])

  const canChooseCamps = teamVenueId !== null && campOptions.length > 0
  const canSubmit = !disabled && canChooseCamps && selectedCampIds.length > 0
  const isFabTrigger = triggerVariant === "fab"
  const idPrefix = `report-${surface}`

  function toggleCampSelection(campId: string): void {
    setSelectedCampIds((currentValue) =>
      currentValue.includes(campId)
        ? currentValue.filter((selectedId) => selectedId !== campId)
        : [...currentValue, campId],
    )
  }

  if (surface === "drawer") {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <Button
          type="button"
          variant={isFabTrigger ? "default" : "outline"}
          size={isFabTrigger ? "icon" : "default"}
          disabled={disabled}
          aria-label={isFabTrigger ? "New report" : undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={
            isFabTrigger
              ? "mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
              : "h-11 px-3"
          }
          onClick={() => {
            setReportName("")
            setSelectedCampIds([])
            setOpen(true)
          }}
        >
          <PlusIcon className={isFabTrigger ? "size-6" : "size-4"} />
          {isFabTrigger ? <span className="sr-only">New report</span> : "New"}
        </Button>

        <DrawerContent className="flex max-h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Create report</DrawerTitle>
            <DrawerDescription>
              Select one or more camps for {year}. New reports are immutable records.
            </DrawerDescription>
          </DrawerHeader>

          <ReportDialogForm
            campOptions={campOptions}
            canChooseCamps={canChooseCamps}
            canSubmit={canSubmit}
            idPrefix={idPrefix}
            onToggleCampSelection={toggleCampSelection}
            redirectTo={redirectTo}
            reportName={reportName}
            scope={scope}
            selectedCampIds={selectedCampIds}
            setReportName={setReportName}
            surface="drawer"
            teamVenueId={teamVenueId}
            year={year}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (nextOpen) {
          setReportName("")
          setSelectedCampIds([])
        }
      }}
    >
      <SheetTrigger
        render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}
      >
        <PlusIcon className="size-4" />
        New
      </SheetTrigger>

      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Create report</SheetTitle>
          <SheetDescription>
            Select one or more camps for {year}. New reports are immutable records.
          </SheetDescription>
        </SheetHeader>

        <ReportDialogForm
          campOptions={campOptions}
          canChooseCamps={canChooseCamps}
          canSubmit={canSubmit}
          idPrefix={idPrefix}
          onToggleCampSelection={toggleCampSelection}
          redirectTo={redirectTo}
          reportName={reportName}
          scope={scope}
          selectedCampIds={selectedCampIds}
          setReportName={setReportName}
          surface="sheet"
          teamVenueId={teamVenueId}
          year={year}
        />
      </SheetContent>
    </Sheet>
  )
}

function TeamReportDialogForm({
  campOptions,
  canSubmit,
  filteredCampOptions,
  idPrefix,
  onSelectedVenueChange,
  onSelectedYearChange,
  onToggleCampSelection,
  redirectTo,
  scope,
  selectedCampIds,
  selectedVenueId,
  selectedYear,
  surface,
  venueOptions,
  yearOptions,
}: {
  campOptions: TeamReportCreateCampOption[]
  canSubmit: boolean
  filteredCampOptions: TeamReportCreateCampOption[]
  idPrefix: string
  onSelectedVenueChange: (value: string) => void
  onSelectedYearChange: (value: number) => void
  onToggleCampSelection: (campId: string) => void
  redirectTo: string
  scope: NavigationScope
  selectedCampIds: string[]
  selectedVenueId: string
  selectedYear: number
  surface: ReportFormSurface
  venueOptions: TeamReportCreateVenueOption[]
  yearOptions: number[]
}) {
  const isDrawerSurface = surface === "drawer"
  const selectClassName = isDrawerSurface
    ? "h-11 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm"
    : "h-9 w-full rounded-md border border-input bg-background px-3 text-sm"

  return (
    <form
      action={createTeamVenueReportAction}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <ReportDialogFieldset
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-venue`}>Venue</Label>
          <select
            id={`${idPrefix}-venue`}
            name="teamVenueId"
            value={selectedVenueId}
            onChange={(event) => onSelectedVenueChange(event.target.value)}
            className={selectClassName}
            disabled={venueOptions.length === 0}
          >
            {venueOptions.map((venueOption) => (
              <option key={venueOption.teamVenueId} value={venueOption.teamVenueId}>
                {venueOption.venueName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-year`}>Year</Label>
          <select
            id={`${idPrefix}-year`}
            name="year"
            value={String(selectedYear)}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10)
              if (Number.isFinite(parsed)) {
                onSelectedYearChange(parsed)
              }
            }}
            className={selectClassName}
            disabled={yearOptions.length === 0}
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

          {campOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No camps are available for report creation.
            </p>
          ) : filteredCampOptions.length === 0 ? (
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
                      onChange={() => onToggleCampSelection(camp.campId)}
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
      </ReportDialogFieldset>

      <ReportDialogFooter
        canSubmit={canSubmit}
        pendingLabel="Creating..."
        submitLabel="Create"
        surface={surface}
      />
    </form>
  )
}

export function CreateTeamReportDialog({
  scope,
  redirectTo,
  venueOptions,
  campOptions,
  disabled = false,
  surface = "sheet",
  triggerVariant = "default",
}: {
  scope: NavigationScope
  redirectTo: string
  venueOptions: TeamReportCreateVenueOption[]
  campOptions: TeamReportCreateCampOption[]
  currentPage?: number
  disabled?: boolean
  surface?: ReportFormSurface
  triggerVariant?: "default" | "fab"
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
    !disabled &&
    selectedVenueId.length > 0 &&
    Number.isFinite(selectedYear) &&
    selectedCampIds.length > 0
  const idPrefix = `team-report-${surface}`
  const isFabTrigger = triggerVariant === "fab"

  if (surface === "drawer") {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <Button
          type="button"
          variant={isFabTrigger ? "default" : "outline"}
          size={isFabTrigger ? "icon" : "default"}
          disabled={disabled}
          aria-label={isFabTrigger ? "New report" : undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={
            isFabTrigger
              ? "mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
              : "h-11 px-3"
          }
          onClick={() => {
            resetDraft()
            setOpen(true)
          }}
        >
          <PlusIcon className={isFabTrigger ? "size-6" : "size-4"} />
          {isFabTrigger ? <span className="sr-only">New report</span> : "New"}
        </Button>

        <DrawerContent className="flex max-h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Create report</DrawerTitle>
            <DrawerDescription>
              Select venue, year, and camps to create a new report.
            </DrawerDescription>
          </DrawerHeader>

          <TeamReportDialogForm
            campOptions={campOptions}
            canSubmit={canSubmit}
            filteredCampOptions={filteredCampOptions}
            idPrefix={idPrefix}
            onSelectedVenueChange={setSelectedVenueId}
            onSelectedYearChange={setSelectedYear}
            onToggleCampSelection={toggleCampSelection}
            redirectTo={redirectTo}
            scope={scope}
            selectedCampIds={selectedCampIds}
            selectedVenueId={selectedVenueId}
            selectedYear={selectedYear}
            surface="drawer"
            venueOptions={venueOptions}
            yearOptions={yearOptions}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (nextOpen) {
          resetDraft()
        }
      }}
    >
      <SheetTrigger
        render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}
      >
        <PlusIcon className="size-4" />
        New
      </SheetTrigger>

      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Create report</SheetTitle>
          <SheetDescription>
            Select venue, year, and camps to create a new report.
          </SheetDescription>
        </SheetHeader>

        <TeamReportDialogForm
          campOptions={campOptions}
          canSubmit={canSubmit}
          filteredCampOptions={filteredCampOptions}
          idPrefix={idPrefix}
          onSelectedVenueChange={setSelectedVenueId}
          onSelectedYearChange={setSelectedYear}
          onToggleCampSelection={toggleCampSelection}
          redirectTo={redirectTo}
          scope={scope}
          selectedCampIds={selectedCampIds}
          selectedVenueId={selectedVenueId}
          selectedYear={selectedYear}
          surface="sheet"
          venueOptions={venueOptions}
          yearOptions={yearOptions}
        />
      </SheetContent>
    </Sheet>
  )
}
