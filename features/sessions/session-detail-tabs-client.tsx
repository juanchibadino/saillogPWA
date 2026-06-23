"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Loader2Icon, MinusIcon, PlusIcon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { updateSessionDetailAction } from "@/features/sessions/actions"
import type { SessionAssetsPanelProps } from "@/features/sessions/detail/assets-panel"
import type { SessionGearTabPanelProps } from "@/features/sessions/detail/gear-panel"
import type { GoalsPanelProps } from "@/features/sessions/detail/goals-panel"
import type { SessionInfoPanelProps } from "@/features/sessions/detail/info-panel"
import {
  MobileSessionDetailTabsList,
  formatSessionDetailTabLabel,
  resolveSessionDetailTab,
} from "@/features/sessions/detail/mobile-tabs"
import type { ResultsPanelProps } from "@/features/sessions/detail/results-panel"
import type { SetupDialogProps } from "@/features/sessions/detail/setup-dialog"
import type {
  SessionDetailAsset,
  SessionDetailGearItem,
  SessionDetailInfo,
  SessionSetupDialogItem,
} from "@/features/sessions/detail-types"
import {
  SESSION_DETAIL_TABS,
  type SessionDetailTab,
} from "@/features/sessions/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

function formatTimeInputValue(iso: string | null): string {
  if (!iso) {
    return ""
  }

  const date = new Date(iso)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const hours = String(date.getUTCHours()).padStart(2, "0")
  const minutes = String(date.getUTCMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

const SESSION_DURATION_STEP_MINUTES = 15
const MIN_SESSION_DURATION_MINUTES = SESSION_DURATION_STEP_MINUTES
const DEFAULT_SESSION_DURATION_MINUTES = 60
const MAX_SESSION_DURATION_MINUTES = 24 * 60

function clampSessionDurationMinutes(minutes: number): number {
  return Math.min(Math.max(minutes, MIN_SESSION_DURATION_MINUTES), MAX_SESSION_DURATION_MINUTES)
}

function resolveSessionDurationMinutes(input: {
  dockOutAt: string | null
  dockInAt: string | null
  fallbackNetTimeMinutes: number | null
}): number {
  let minutes: number | null = input.fallbackNetTimeMinutes

  if (input.dockOutAt && input.dockInAt) {
    const start = new Date(input.dockOutAt)
    const end = new Date(input.dockInAt)

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const diffMinutes = Math.floor((end.getTime() - start.getTime()) / (60 * 1000))
      if (diffMinutes >= 0) {
        minutes = diffMinutes
      }
    }
  }

  if (minutes === null || minutes <= 0) {
    return DEFAULT_SESSION_DURATION_MINUTES
  }

  const roundedMinutes =
    Math.round(minutes / SESSION_DURATION_STEP_MINUTES) * SESSION_DURATION_STEP_MINUTES

  return clampSessionDurationMinutes(roundedMinutes)
}

function formatSessionDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours <= 0) {
    return `${remainingMinutes}m`
  }

  return `${hours}h ${remainingMinutes}m`
}

function formatSessionDurationHoursValue(minutes: number): string {
  const hours = minutes / 60
  const rounded = Math.round(hours * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}


const SetupDialog = dynamic<SetupDialogProps>(
  () => import("@/features/sessions/detail/setup-dialog").then((module) => module.SetupDialog),
  {
    loading: () => (
      <Button type="button" variant="outline" size="sm" disabled>
        Setup
      </Button>
    ),
  },
)

const SessionInfoPanel = dynamic<SessionInfoPanelProps>(
  () => import("@/features/sessions/detail/info-panel").then((module) => module.SessionInfoPanel),
  { loading: () => <SessionDynamicPanelFallback /> },
)

const GoalsPanel = dynamic<GoalsPanelProps>(
  () => import("@/features/sessions/detail/goals-panel").then((module) => module.GoalsPanel),
  { loading: () => <SessionDynamicPanelFallback /> },
)

const ResultsPanel = dynamic<ResultsPanelProps>(
  () => import("@/features/sessions/detail/results-panel").then((module) => module.ResultsPanel),
  { loading: () => <SessionDynamicPanelFallback /> },
)

const SessionAssetsPanel = dynamic<SessionAssetsPanelProps>(
  () => import("@/features/sessions/detail/assets-panel").then((module) => module.SessionAssetsPanel),
  { loading: () => <SessionDynamicPanelFallback /> },
)

const SessionGearTabPanel = dynamic<SessionGearTabPanelProps>(
  () => import("@/features/sessions/detail/gear-panel").then((module) => module.SessionGearTabPanel),
  { loading: () => <SessionDynamicPanelFallback /> },
)

function SessionDynamicPanelFallback() {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      <Loader2Icon className="mr-2 size-4 animate-spin" />
      Loading...
    </div>
  )
}


function EditSessionMetadataDialog(input: {
  sessionId: string
  scope: NavigationScope
  sessionType: "training" | "regatta"
  sessionDate: string
  dockOutAt: string | null
  dockInAt: string | null
  netTimeMinutes: number | null
}) {
  function EditSessionDialogSubmitButton(props: { className?: string }) {
    const { pending } = useFormStatus()

    return (
      <Button type="submit" disabled={pending} className={props.className}>
        {pending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save"
        )}
      </Button>
    )
  }

  function EditSessionDialogFieldset(props: { children: React.ReactNode }) {
    const { pending } = useFormStatus()

    return <fieldset disabled={pending}>{props.children}</fieldset>
  }

  const [nextSessionType, setNextSessionType] = React.useState(input.sessionType)
  const [nextSessionDate, setNextSessionDate] = React.useState(input.sessionDate)
  const [nextStartTime, setNextStartTime] = React.useState(formatTimeInputValue(input.dockOutAt))
  const [nextTotalDurationMinutes, setNextTotalDurationMinutes] = React.useState(() =>
    resolveSessionDurationMinutes({
      dockOutAt: input.dockOutAt,
      dockInAt: input.dockInAt,
      fallbackNetTimeMinutes: input.netTimeMinutes,
    }),
  )
  const isMobile = useIsMobile()
  const totalDurationLabelId = `session-duration-label-${input.sessionId}`
  const nextTotalDurationHours = formatSessionDurationHoursValue(nextTotalDurationMinutes)

  function adjustTotalDurationMinutes(deltaMinutes: number): void {
    setNextTotalDurationMinutes((currentMinutes) =>
      clampSessionDurationMinutes(currentMinutes + deltaMinutes),
    )
  }

  const editSessionForm = (
    <form
      action={updateSessionDetailAction}
      className={cn("flex min-h-0 flex-col", isMobile ? "flex-none" : "flex-1")}
    >
      <input type="hidden" name="id" value={input.sessionId} />
      <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
      {input.scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
      ) : null}
      <input type="hidden" name="scopeTab" value="info" />

      <div
        className={cn(
          "overflow-y-auto px-4 pb-4",
          isMobile ? "max-h-[calc(85dvh-10rem)]" : "min-h-0 flex-1",
        )}
      >
        <div className="space-y-4">
          <EditSessionDialogFieldset>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`session-type-${input.sessionId}`}>Type</Label>
                <select
                  id={`session-type-${input.sessionId}`}
                  name="sessionType"
                  required
                  value={nextSessionType}
                  onChange={(event) => setNextSessionType(event.target.value as "training" | "regatta")}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="training">Training</option>
                  <option value="regatta">Regatta</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`session-date-${input.sessionId}`}>Date</Label>
                <Input
                  id={`session-date-${input.sessionId}`}
                  name="sessionDate"
                  type="date"
                  required
                  value={nextSessionDate}
                  onChange={(event) => setNextSessionDate(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`session-start-${input.sessionId}`}>Start Time (UTC)</Label>
                <Input
                  id={`session-start-${input.sessionId}`}
                  name="startTime"
                  type="time"
                  required
                  value={nextStartTime}
                  onChange={(event) => setNextStartTime(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label id={totalDurationLabelId}>Total Duration</Label>
                <input type="hidden" name="totalDurationHours" value={nextTotalDurationHours} />
                <div
                  className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2"
                  role="group"
                  aria-labelledby={totalDurationLabelId}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className="size-12"
                    aria-label="Decrease total duration by 15 minutes"
                    disabled={nextTotalDurationMinutes <= MIN_SESSION_DURATION_MINUTES}
                    onClick={() => adjustTotalDurationMinutes(-SESSION_DURATION_STEP_MINUTES)}
                  >
                    <MinusIcon className="size-5" />
                  </Button>
                  <div
                    className="flex h-12 min-w-0 items-center justify-center rounded-lg border border-input bg-background px-3 text-base font-medium tabular-nums"
                    aria-live="polite"
                  >
                    {formatSessionDurationLabel(nextTotalDurationMinutes)}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className="size-12"
                    aria-label="Increase total duration by 15 minutes"
                    disabled={nextTotalDurationMinutes >= MAX_SESSION_DURATION_MINUTES}
                    onClick={() => adjustTotalDurationMinutes(SESSION_DURATION_STEP_MINUTES)}
                  >
                    <PlusIcon className="size-5" />
                  </Button>
                </div>
              </div>
            </div>
          </EditSessionDialogFieldset>
        </div>
      </div>

      {isMobile ? (
        <DrawerFooter className="shrink-0 border-t">
          <EditSessionDialogSubmitButton className="w-full" />
        </DrawerFooter>
      ) : (
        <SheetFooter className="shrink-0 border-t">
          <EditSessionDialogSubmitButton className="w-full" />
        </SheetFooter>
      )}
    </form>
  )

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <Button type="button" variant="outline" size="default" className="h-9 px-3">
            Edit
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Edit Session</DrawerTitle>
          </DrawerHeader>
          {editSessionForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Edit
      </SheetTrigger>
      <SheetContent side="right" className="h-full overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>Edit Session</SheetTitle>
        </SheetHeader>
        {editSessionForm}
      </SheetContent>
    </Sheet>
  )
}


export function SessionHeaderActions(input: {
  sessionId: string
  scope: NavigationScope
  setupDialogItems: SessionSetupDialogItem[]
  sessionType: "training" | "regatta"
  sessionDate: string
  dockOutAt: string | null
  dockInAt: string | null
  netTimeMinutes: number | null
  canManageSession: boolean
}) {
  if (!input.canManageSession) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <SetupDialog
        sessionId={input.sessionId}
        scope={input.scope}
        items={input.setupDialogItems}
      />
      <EditSessionMetadataDialog
        sessionId={input.sessionId}
        scope={input.scope}
        sessionType={input.sessionType}
        sessionDate={input.sessionDate}
        dockOutAt={input.dockOutAt}
        dockInAt={input.dockInAt}
        netTimeMinutes={input.netTimeMinutes}
      />
    </div>
  )
}

export function SessionDetailTabsClient(input: {
  initialTab: SessionDetailTab
  scope: NavigationScope
  sessionId: string
  sessionType: "training" | "regatta"
  info: SessionDetailInfo
  goals: string | null
  availableStandardMoves: SessionInfoPanelProps["availableStandardMoves"]
  linkedStandardMoveIds: string[]
  availableWindPatterns: SessionInfoPanelProps["availableWindPatterns"]
  linkedWindPatternIds: string[]
  resultNotes: string | null
  images: SessionDetailAsset[]
  analyticsFiles: SessionDetailAsset[]
  gearItems: SessionDetailGearItem[]
  linkedGearItemIds: string[]
  canManageSession: boolean
}) {
  const [selectedTab, setSelectedTab] = React.useState<SessionDetailTab>(input.initialTab)

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => setSelectedTab(resolveSessionDetailTab(value))}
      className="space-y-4"
    >
      <div className="md:hidden">
        <MobileSessionDetailTabsList selectedTab={selectedTab} onTabChange={setSelectedTab} />
      </div>

      <TabsList className="hidden h-10 md:inline-flex">
        {SESSION_DETAIL_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="min-w-fit capitalize">
            {formatSessionDetailTabLabel(tab)}
          </TabsTrigger>
        ))}
      </TabsList>

      <section className="rounded-xl border bg-card p-4 sm:p-6">
        {selectedTab === "info" ? (
          <TabsContent value="info" className="space-y-4">
            <SessionInfoPanel
              sessionId={input.sessionId}
              scope={input.scope}
              info={input.info}
              availableStandardMoves={input.availableStandardMoves}
              linkedStandardMoveIds={input.linkedStandardMoveIds}
              availableWindPatterns={input.availableWindPatterns}
              linkedWindPatternIds={input.linkedWindPatternIds}
              canManageSession={input.canManageSession}
            />
          </TabsContent>
        ) : null}

        {selectedTab === "goals" ? (
          <TabsContent value="goals" className="space-y-4">
            <GoalsPanel
              sessionId={input.sessionId}
              scope={input.scope}
              goals={input.goals}
              canManageSession={input.canManageSession}
            />
          </TabsContent>
        ) : null}

        {selectedTab === "results" ? (
          <TabsContent value="results" className="space-y-4">
            <ResultsPanel
              sessionId={input.sessionId}
              scope={input.scope}
              resultNotes={input.resultNotes}
              canManageSession={input.canManageSession}
            />
          </TabsContent>
        ) : null}

        {selectedTab === "images" ? (
          <TabsContent value="images" className="space-y-4">
            <SessionAssetsPanel
              title="Images"
              sessionId={input.sessionId}
              scope={input.scope}
              assetType="photo"
              tab="images"
              accept="image/*"
              buttonLabel="Upload image"
              assets={input.images}
              emptyMessage="No images uploaded for this session yet."
              canManageSession={input.canManageSession}
            />
          </TabsContent>
        ) : null}

        {selectedTab === "analytics" ? (
          <TabsContent value="analytics" className="space-y-4">
            <SessionAssetsPanel
              title="Analytics"
              sessionId={input.sessionId}
              scope={input.scope}
              assetType="analytics_file"
              tab="analytics"
              accept="application/pdf,.pdf"
              buttonLabel="Upload PDF"
              assets={input.analyticsFiles}
              emptyMessage="No analytics PDFs uploaded for this session yet."
              canManageSession={input.canManageSession}
            />
          </TabsContent>
        ) : null}

        {selectedTab === "gear" ? (
          <TabsContent value="gear" className="space-y-4">
            <SessionGearTabPanel
              sessionId={input.sessionId}
              scope={input.scope}
              gearItems={input.gearItems}
              linkedGearItemIds={input.linkedGearItemIds}
              canManageSession={input.canManageSession}
            />
          </TabsContent>
        ) : null}
      </section>
    </Tabs>
  )
}
