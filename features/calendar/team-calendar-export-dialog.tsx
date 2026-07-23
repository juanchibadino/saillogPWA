"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"
import {
  CalendarDaysIcon,
  CopyIcon,
  DownloadIcon,
  Loader2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  generateTeamCalendarFeedAction,
  rotateTeamCalendarFeedAction,
  type TeamCalendarFeedActionResult,
} from "@/features/calendar/feed-actions"
import type { TeamCalendarFeedState } from "@/features/calendar/feed-data"
import type { TeamCalendarTimeFilter } from "@/features/calendar/data"
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
import { Input } from "@/components/ui/input"

type TeamCalendarExportDialogProps = {
  disabled?: boolean
  feedState: TeamCalendarFeedState
  returnPath: string
  scope: NavigationScope
  selectedEventValue: string
  selectedMemberId?: string | null
  selectedTimeFilter: TeamCalendarTimeFilter
  triggerVariant: "button" | "icon"
}

function CalendarFeedScopeFields({
  returnPath,
  scope,
  selectedEventValue,
  selectedMemberId,
  selectedTimeFilter,
}: {
  returnPath: string
  scope: NavigationScope
  selectedEventValue: string
  selectedMemberId?: string | null
  selectedTimeFilter: TeamCalendarTimeFilter
}) {
  return (
    <>
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {selectedMemberId ? (
        <input type="hidden" name="scopeMemberId" value={selectedMemberId} />
      ) : null}
      {selectedEventValue ? (
        <input type="hidden" name="scopeEvent" value={selectedEventValue} />
      ) : null}
      <input type="hidden" name="scopeTime" value={selectedTimeFilter} />
      <input type="hidden" name="scopeReturnPath" value={returnPath} />
    </>
  )
}

function FeedSubmitButton({
  className,
  label,
  pendingLabel,
  variant = "default",
}: {
  className?: string
  label: string
  pendingLabel: string
  variant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  )
}

export function TeamCalendarExportDialog({
  disabled = false,
  feedState,
  returnPath,
  scope,
  selectedEventValue,
  selectedMemberId,
  selectedTimeFilter,
  triggerVariant,
}: TeamCalendarExportDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [isDownloadPending, setIsDownloadPending] = React.useState(false)
  const [currentFeedState, setCurrentFeedState] =
    React.useState<TeamCalendarFeedState>(feedState)
  const downloadPendingTimeoutRef = React.useRef<number | null>(null)
  const [generateState, generateAction] = React.useActionState<
    TeamCalendarFeedActionResult | null,
    FormData
  >(generateTeamCalendarFeedAction, null)
  const [rotateState, rotateAction] = React.useActionState<
    TeamCalendarFeedActionResult | null,
    FormData
  >(rotateTeamCalendarFeedAction, null)
  const hasFeed = Boolean(currentFeedState.feedUrl)

  React.useEffect(() => {
    return () => {
      if (downloadPendingTimeoutRef.current) {
        window.clearTimeout(downloadPendingTimeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    setCurrentFeedState(feedState)
  }, [feedState])

  React.useEffect(() => {
    if (!generateState) {
      return
    }

    if (!generateState.ok) {
      toast.error(generateState.message)
      return
    }

    if (generateState.feedState) {
      setCurrentFeedState(generateState.feedState)
    }

    toast.success(generateState.message)
  }, [generateState])

  React.useEffect(() => {
    if (!rotateState) {
      return
    }

    if (!rotateState.ok) {
      toast.error(rotateState.message)
      return
    }

    if (rotateState.feedState) {
      setCurrentFeedState(rotateState.feedState)
    }

    toast.success(rotateState.message)
  }, [rotateState])

  async function copyFeedUrl(): Promise<void> {
    if (!currentFeedState.feedUrl || !navigator.clipboard) {
      toast.error("Could not copy calendar link.")
      return
    }

    try {
      await navigator.clipboard.writeText(currentFeedState.feedUrl)
      toast.success("Calendar link copied.")
    } catch {
      toast.error("Could not copy calendar link.")
    }
  }

  function handleDownloadClick(event: React.MouseEvent<HTMLAnchorElement>): void {
    if (isDownloadPending) {
      event.preventDefault()
      return
    }

    setIsDownloadPending(true)

    if (downloadPendingTimeoutRef.current) {
      window.clearTimeout(downloadPendingTimeoutRef.current)
    }

    downloadPendingTimeoutRef.current = window.setTimeout(() => {
      setIsDownloadPending(false)
      downloadPendingTimeoutRef.current = null
    }, 1200)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          triggerVariant === "icon" ? (
            <Button
              type="button"
              variant="secondary"
              size="default"
              disabled={disabled}
              className="h-11 w-11 px-0"
              aria-label="Export calendar"
            />
          ) : (
            <Button type="button" variant="outline" size="sm" disabled={disabled} />
          )
        }
      >
        <CalendarDaysIcon className="size-4" />
        {triggerVariant === "button" ? <span>Export</span> : null}
      </DialogTrigger>

      <DialogContent
        className="overflow-hidden p-0 sm:max-w-lg"
        overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader className="gap-2 px-5 pt-5 pb-1">
          <DialogTitle>Calendar export</DialogTitle>
          <DialogDescription>
            Private read-only link for Google Calendar and Outlook.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {hasFeed && currentFeedState.feedUrl ? (
            <>
              <div className="space-y-2">
                <label
                  htmlFor="team-calendar-feed-url"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Calendar link
                </label>
                <div className="relative">
                  <Input
                    id="team-calendar-feed-url"
                    readOnly
                    value={currentFeedState.feedUrl}
                    className="h-11 pr-12 font-mono text-xs"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={copyFeedUrl}
                    aria-label="Copy calendar link"
                  >
                    <CopyIcon className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              Generate a private link for this team calendar.
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 flex-col gap-2 px-5 pt-4 pb-5 sm:flex-row sm:justify-end">
          {hasFeed ? (
            <>
              <form action={rotateAction} className="w-full sm:w-auto">
                <CalendarFeedScopeFields
                  returnPath={returnPath}
                  scope={scope}
                  selectedEventValue={selectedEventValue}
                  selectedMemberId={selectedMemberId}
                  selectedTimeFilter={selectedTimeFilter}
                />
                <FeedSubmitButton
                  label="Regenerate link"
                  pendingLabel="Regenerating..."
                  variant="outline"
                  className="h-9 w-full sm:w-auto"
                />
              </form>
              {currentFeedState.downloadUrl ? (
                <Button
                  variant="outline"
                  aria-busy={isDownloadPending}
                  aria-disabled={isDownloadPending}
                  className="h-9 w-full sm:w-auto"
                  render={
                    <a
                      href={currentFeedState.downloadUrl}
                      download="team-calendar.ics"
                      onClick={handleDownloadClick}
                    />
                  }
                >
                  {isDownloadPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <DownloadIcon className="size-4" />
                  )}
                  {isDownloadPending ? "Downloading..." : "Download .ics"}
                </Button>
              ) : null}
            </>
          ) : (
            <form action={generateAction} className="w-full sm:w-auto">
              <CalendarFeedScopeFields
                returnPath={returnPath}
                scope={scope}
                selectedEventValue={selectedEventValue}
                selectedMemberId={selectedMemberId}
                selectedTimeFilter={selectedTimeFilter}
              />
              <FeedSubmitButton
                label="Generate link"
                pendingLabel="Generating..."
                className="h-9 w-full sm:w-auto"
              />
            </form>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
