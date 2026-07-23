"use client"

import * as React from "react"
import { Loader2Icon, PlusIcon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { createAssessmentRunAction } from "@/features/assessments/actions"
import { AssessmentScopeFields } from "@/features/assessments/assessment-scope-fields"
import type {
  TeamAssessmentCampOption,
  TeamAssessmentTemplateOption,
  TeamAssessmentVenueOption,
} from "@/features/assessments/data"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

function RunCreateSubmitButton({
  className,
  disabledByValidation,
}: {
  className?: string
  disabledByValidation: boolean
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending || disabledByValidation} className={className}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {pending ? "Creating Assessment..." : "Create Assessment"}
    </Button>
  )
}

export function TeamAssessmentRunCreateDialog({
  campOptions,
  disabled,
  returnPath,
  scope,
  templateOptions,
  venueOptions,
}: {
  campOptions: TeamAssessmentCampOption[]
  disabled: boolean
  returnPath: string
  scope: NavigationScope
  templateOptions: TeamAssessmentTemplateOption[]
  venueOptions: TeamAssessmentVenueOption[]
}) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedTeamVenueId, setSelectedTeamVenueId] = React.useState("")
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("")
  const [selectedCampIds, setSelectedCampIds] = React.useState<string[]>([])
  const availableCampOptions = React.useMemo(
    () => campOptions.filter((camp) => camp.teamVenueId === selectedTeamVenueId),
    [campOptions, selectedTeamVenueId],
  )
  const canSubmit =
    selectedTeamVenueId.length > 0 &&
    selectedTemplateId.length > 0 &&
    selectedCampIds.length > 0

  function toggleCamp(campId: string): void {
    setSelectedCampIds((currentValue) => {
      if (currentValue.includes(campId)) {
        return currentValue.filter((value) => value !== campId)
      }

      return [...currentValue, campId]
    })
  }

  function renderForm(surface: "drawer" | "sheet") {
    const isDrawerSurface = surface === "drawer"
    const selectClassName = isDrawerSurface
      ? "h-11 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm"
      : "h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
    const footer = isDrawerSurface ? (
      <DrawerFooter className="shrink-0 border-t">
        <RunCreateSubmitButton disabledByValidation={!canSubmit} className="h-11 w-full" />
      </DrawerFooter>
    ) : (
      <SheetFooter className="shrink-0 border-t sm:justify-end">
        <RunCreateSubmitButton disabledByValidation={!canSubmit} />
      </SheetFooter>
    )

    return (
      <form action={createAssessmentRunAction} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AssessmentScopeFields scope={scope} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <input type="hidden" name="teamVenueId" value={selectedTeamVenueId} />
        <input type="hidden" name="templateId" value={selectedTemplateId} />
        <input type="hidden" name="campIdsJson" value={JSON.stringify(selectedCampIds)} />

        <fieldset className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={`assessment-run-venue-${surface}`}>Venue</Label>
            <select
              id={`assessment-run-venue-${surface}`}
              value={selectedTeamVenueId}
              className={selectClassName}
              onChange={(event) => {
                setSelectedTeamVenueId(event.target.value)
                setSelectedCampIds([])
              }}
            >
              <option value="">Select venue</option>
              {venueOptions.map((venue) => (
                <option key={venue.teamVenueId} value={venue.teamVenueId}>
                  {venue.venueName} - {venue.venueLocation}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`assessment-run-template-${surface}`}>Template</Label>
            <select
              id={`assessment-run-template-${surface}`}
              value={selectedTemplateId}
              className={selectClassName}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
            >
              <option value="">Select template</option>
              {templateOptions.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Camps</Label>
            {!selectedTeamVenueId ? (
              <p className="text-sm text-muted-foreground">Select a venue first.</p>
            ) : availableCampOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No camps are available for this venue.
              </p>
            ) : (
              <div className="grid gap-2 rounded-lg border p-3">
                {availableCampOptions.map((camp) => (
                  <label
                    key={camp.campId}
                    className="flex min-h-11 items-start gap-2 py-1 text-sm md:min-h-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCampIds.includes(camp.campId)}
                      onChange={() => toggleCamp(camp.campId)}
                    />
                    <span>
                      <span className="font-medium">{camp.campName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {camp.dateRangeLabel}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </fieldset>

        {footer}
      </form>
    )
  }

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <Button
          type="button"
          variant="default"
          size="icon"
          disabled={disabled}
          aria-label="New assessment"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className="mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
          onClick={() => setIsOpen(true)}
        >
          <PlusIcon className="size-6" />
        </Button>
        <DrawerContent className="flex max-h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Create Assessment</DrawerTitle>
          </DrawerHeader>
          {renderForm("drawer")}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}>
        <PlusIcon className="size-4" />
        New
      </SheetTrigger>
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-3xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Create Assessment</SheetTitle>
        </SheetHeader>
        {renderForm("sheet")}
      </SheetContent>
    </Sheet>
  )
}
