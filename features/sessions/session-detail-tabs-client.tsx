"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Loader2Icon, MinusIcon, PlusIcon, Settings2Icon } from "lucide-react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

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
  SessionDetailAnalyticsTabData,
  SessionDetailGearTabData,
  SessionDetailGoalsTabData,
  SessionDetailImagesTabData,
  SessionDetailInfoTabData,
  SessionDetailResultsTabData,
  SessionDetailSetupData,
  SessionDetailTabDataByTab,
  SessionDetailTabPayload,
} from "@/features/sessions/detail-types"
import {
  SESSION_DETAIL_TABS,
  type SessionDetailTab,
} from "@/features/sessions/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
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

function SetupDialogLoadingFallback() {
  return (
    <>
      <Button
        type="button"
        variant="default"
        size="icon"
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-[45] size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
        aria-label="Loading session setup"
        disabled
      >
        <Settings2Icon className="size-6" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden md:inline-flex"
        disabled
      >
        Setup
      </Button>
    </>
  )
}

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
  { loading: () => <SetupDialogLoadingFallback /> },
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
  sessionType: "training" | "regatta"
  sessionDate: string
  dockOutAt: string | null
  dockInAt: string | null
  netTimeMinutes: number | null
  canManageSession: boolean
}) {
  const [setupData, setSetupData] = React.useState<SessionDetailSetupData | null>(null)
  const [setupLoadError, setSetupLoadError] = React.useState<string | null>(null)
  const [isSetupLoading, setIsSetupLoading] = React.useState(false)
  const setupInFlightRef = React.useRef(false)
  const setupRequestVersionRef = React.useRef(0)

  React.useEffect(() => {
    setupRequestVersionRef.current += 1
    setupInFlightRef.current = false
    setSetupData(null)
    setSetupLoadError(null)
    setIsSetupLoading(false)
  }, [input.scope.activeOrgId, input.scope.activeTeamId, input.sessionId])

  const loadSetupData = React.useCallback(
    async (options?: { force?: boolean }) => {
      if (!options?.force && setupData) {
        return
      }

      if (setupInFlightRef.current) {
        return
      }

      const requestVersion = setupRequestVersionRef.current
      setupInFlightRef.current = true
      setIsSetupLoading(true)
      setSetupLoadError(null)

      try {
        const nextSetupData = await fetchSessionDetailSetupData({
          scope: input.scope,
          sessionId: input.sessionId,
        })

        if (requestVersion !== setupRequestVersionRef.current) {
          return
        }

        setSetupData(nextSetupData)
      } catch (error) {
        if (requestVersion !== setupRequestVersionRef.current) {
          return
        }

        const message = error instanceof Error ? error.message : "Could not load Setup."
        setSetupLoadError(message)
      } finally {
        if (requestVersion === setupRequestVersionRef.current) {
          setupInFlightRef.current = false
          setIsSetupLoading(false)
        }
      }
    },
    [input.scope, input.sessionId, setupData],
  )

  if (!input.canManageSession) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <SetupDialog
        sessionId={input.sessionId}
        scope={input.scope}
        items={setupData?.setupDialogItems ?? []}
        isLoading={isSetupLoading && !setupData}
        loadError={setupData ? null : setupLoadError}
        onOpen={() => void loadSetupData()}
        onRetry={() => void loadSetupData({ force: true })}
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

type SessionDetailTabDataState = {
  analytics?: SessionDetailAnalyticsTabData
  gear?: SessionDetailGearTabData
  goals: SessionDetailGoalsTabData
  images?: SessionDetailImagesTabData
  info?: SessionDetailInfoTabData
  results?: SessionDetailResultsTabData
}

type SessionDetailTabDataResponse = {
  [Tab in SessionDetailTab]: {
    data: SessionDetailTabDataByTab[Tab]
    tab: Tab
  }
}[SessionDetailTab]

type SessionDetailTabLoadError = {
  message: string
  tab: SessionDetailTab
}

type SessionDetailTabErrorPayload = {
  detail?: unknown
  error?: unknown
}

type SessionAssetTab = "images" | "analytics"

type SessionDetailSetupDataResponse = {
  data: SessionDetailSetupData
}

function appendUniqueSessionAssets<T extends { id: string }>(
  currentAssets: T[],
  nextAssets: T[],
): T[] {
  const seenAssetIds = new Set(currentAssets.map((asset) => asset.id))
  const uniqueNextAssets = nextAssets.filter((asset) => {
    if (seenAssetIds.has(asset.id)) {
      return false
    }

    seenAssetIds.add(asset.id)
    return true
  })

  return [...currentAssets, ...uniqueNextAssets]
}

function applySessionDetailTabData(input: {
  data: SessionDetailTabPayload
  state: SessionDetailTabDataState
  tab: SessionDetailTab
}): SessionDetailTabDataState {
  if (input.tab === "info") {
    return {
      ...input.state,
      info: input.data as SessionDetailInfoTabData,
    }
  }

  if (input.tab === "goals") {
    return {
      ...input.state,
      goals: input.data as SessionDetailGoalsTabData,
    }
  }

  if (input.tab === "results") {
    return {
      ...input.state,
      results: input.data as SessionDetailResultsTabData,
    }
  }

  if (input.tab === "images") {
    return {
      ...input.state,
      images: input.data as SessionDetailImagesTabData,
    }
  }

  if (input.tab === "analytics") {
    return {
      ...input.state,
      analytics: input.data as SessionDetailAnalyticsTabData,
    }
  }

  return {
    ...input.state,
    gear: input.data as SessionDetailGearTabData,
  }
}

function appendSessionAssetTabData(input: {
  data: SessionDetailTabPayload
  state: SessionDetailTabDataState
  tab: SessionAssetTab
}): SessionDetailTabDataState {
  if (input.tab === "images") {
    const nextData = input.data as SessionDetailImagesTabData
    const currentImages = input.state.images?.images ?? []

    return {
      ...input.state,
      images: {
        ...nextData,
        images: appendUniqueSessionAssets(currentImages, nextData.images),
      },
    }
  }

  const nextData = input.data as SessionDetailAnalyticsTabData
  const currentAnalyticsFiles = input.state.analytics?.analyticsFiles ?? []

  return {
    ...input.state,
    analytics: {
      ...nextData,
      analyticsFiles: appendUniqueSessionAssets(
        currentAnalyticsFiles,
        nextData.analyticsFiles,
      ),
    },
  }
}

function buildSessionDetailTabDataState(input: {
  goals: string | null
  initialTab: SessionDetailTab
  initialTabData: SessionDetailTabPayload
}): SessionDetailTabDataState {
  return applySessionDetailTabData({
    data: input.initialTabData,
    state: {
      goals: {
        goals: input.goals,
      },
    },
    tab: input.initialTab,
  })
}

function hasSessionDetailTabData(
  state: SessionDetailTabDataState,
  tab: SessionDetailTab,
): boolean {
  if (tab === "info") {
    return typeof state.info !== "undefined"
  }

  if (tab === "goals") {
    return true
  }

  if (tab === "results") {
    return typeof state.results !== "undefined"
  }

  if (tab === "images") {
    return typeof state.images !== "undefined"
  }

  if (tab === "analytics") {
    return typeof state.analytics !== "undefined"
  }

  return typeof state.gear !== "undefined"
}

function buildSessionDetailTabDataUrl(input: {
  assetOffset?: number
  scope: NavigationScope
  sessionId: string
  tab: SessionDetailTab
}): string {
  const params = new URLSearchParams()
  params.set("tab", input.tab)
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (typeof input.assetOffset === "number" && input.assetOffset > 0) {
    params.set("assetOffset", String(input.assetOffset))
  }

  return `/api/team-sessions/${encodeURIComponent(input.sessionId)}/tab-data?${params.toString()}`
}

function buildSessionDetailSetupDataUrl(input: {
  scope: NavigationScope
  sessionId: string
}): string {
  const params = new URLSearchParams()
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  return `/api/team-sessions/${encodeURIComponent(input.sessionId)}/setup?${params.toString()}`
}

async function fetchSessionDetailTabData(input: {
  assetOffset?: number
  scope: NavigationScope
  sessionId: string
  tab: SessionDetailTab
}): Promise<SessionDetailTabPayload> {
  const response = await fetch(buildSessionDetailTabDataUrl(input), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(await resolveSessionDetailTabErrorMessage(response))
  }

  const payload = (await response.json()) as SessionDetailTabDataResponse

  if (payload.tab !== input.tab) {
    throw new Error("The loaded tab data did not match the selected tab.")
  }

  return payload.data
}

async function fetchSessionDetailSetupData(input: {
  scope: NavigationScope
  sessionId: string
}): Promise<SessionDetailSetupData> {
  const response = await fetch(buildSessionDetailSetupDataUrl(input), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(await resolveSessionDetailSetupErrorMessage(response))
  }

  const payload = (await response.json()) as SessionDetailSetupDataResponse
  return payload.data
}

async function resolveSessionDetailTabErrorMessage(response: Response): Promise<string> {
  let payload: SessionDetailTabErrorPayload | null = null

  try {
    payload = (await response.json()) as SessionDetailTabErrorPayload
  } catch {
    payload = null
  }

  const errorCode = typeof payload?.error === "string" ? payload.error : null

  if (response.status === 401 || errorCode === "unauthorized") {
    return "Your session expired. Sign in again, then retry this tab."
  }

  if (response.status === 403 || errorCode === "scope_required") {
    return "This tab needs an active team scope. Select the correct team and retry."
  }

  if (response.status === 404 || errorCode === "session_not_found") {
    return "This session is unavailable in the active team scope."
  }

  if (response.status === 400) {
    return "This tab request is invalid. Refresh the page and try again."
  }

  return "This tab hit a runtime error while loading. Retry just this tab."
}

async function resolveSessionDetailSetupErrorMessage(response: Response): Promise<string> {
  let payload: SessionDetailTabErrorPayload | null = null

  try {
    payload = (await response.json()) as SessionDetailTabErrorPayload
  } catch {
    payload = null
  }

  const errorCode = typeof payload?.error === "string" ? payload.error : null

  if (response.status === 401 || errorCode === "unauthorized") {
    return "Your session expired. Sign in again, then retry Setup."
  }

  if (response.status === 403 || errorCode === "forbidden" || errorCode === "scope_required") {
    return "You do not have permission to manage Setup in the active team scope."
  }

  if (response.status === 404 || errorCode === "session_not_found") {
    return "This session is unavailable in the active team scope."
  }

  if (response.status === 400) {
    return "This Setup request is invalid. Refresh the page and try again."
  }

  return "Setup hit a runtime error while loading. Retry just Setup."
}

function SessionTabDataError(input: {
  error: SessionDetailTabLoadError
  onRetry: () => void
}) {
  const tabLabel = formatSessionDetailTabLabel(input.error.tab)

  return (
    <div
      role="alert"
      className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-center"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">Could not load {tabLabel}.</p>
        <p className="text-sm text-muted-foreground">{input.error.message}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={input.onRetry}>
        Retry
      </Button>
    </div>
  )
}

export function SessionDetailTabsClient(input: {
  initialTab: SessionDetailTab
  initialTabData: SessionDetailTabPayload
  scope: NavigationScope
  sessionId: string
  sessionType: "training" | "regatta"
  goals: string | null
  canManageSession: boolean
}) {
  const [selectedTab, setSelectedTab] = React.useState<SessionDetailTab>(input.initialTab)
  const [tabData, setTabData] = React.useState<SessionDetailTabDataState>(() =>
    buildSessionDetailTabDataState({
      goals: input.goals,
      initialTab: input.initialTab,
      initialTabData: input.initialTabData,
    }),
  )
  const [loadError, setLoadError] = React.useState<SessionDetailTabLoadError | null>(null)
  const [loadingMoreAssetTab, setLoadingMoreAssetTab] = React.useState<SessionAssetTab | null>(
    null,
  )
  const inFlightTabsRef = React.useRef<Set<SessionDetailTab>>(new Set())
  const requestVersionRef = React.useRef(0)

  React.useEffect(() => {
    requestVersionRef.current += 1
    inFlightTabsRef.current.clear()
    setSelectedTab(input.initialTab)
    setTabData(
      buildSessionDetailTabDataState({
        goals: input.goals,
        initialTab: input.initialTab,
        initialTabData: input.initialTabData,
      }),
    )
    setLoadError(null)
    setLoadingMoreAssetTab(null)
  }, [input.goals, input.initialTab, input.initialTabData])

  const loadTabData = React.useCallback(
    async (tab: SessionDetailTab, options?: { force?: boolean }) => {
      if (!options?.force && hasSessionDetailTabData(tabData, tab)) {
        return
      }

      if (inFlightTabsRef.current.has(tab)) {
        return
      }

      const requestVersion = requestVersionRef.current
      inFlightTabsRef.current.add(tab)
      setLoadError((currentError) => (currentError?.tab === tab ? null : currentError))

      try {
        const nextTabData = await fetchSessionDetailTabData({
          scope: input.scope,
          sessionId: input.sessionId,
          tab,
        })

        if (requestVersion !== requestVersionRef.current) {
          return
        }

        setTabData((currentState) =>
          applySessionDetailTabData({
            data: nextTabData,
            state: currentState,
            tab,
          }),
        )
      } catch (error) {
        if (requestVersion !== requestVersionRef.current) {
          return
        }

        const message = error instanceof Error ? error.message : "Could not load this tab."
        setLoadError({ message, tab })
      } finally {
        if (requestVersion === requestVersionRef.current) {
          inFlightTabsRef.current.delete(tab)
        }
      }
    },
    [input.scope, input.sessionId, tabData],
  )

  React.useEffect(() => {
    void loadTabData(selectedTab)
  }, [loadTabData, selectedTab])

  const retrySelectedTab = React.useCallback(() => {
    void loadTabData(selectedTab, { force: true })
  }, [loadTabData, selectedTab])

  const loadMoreAssets = React.useCallback(
    async (tab: SessionAssetTab) => {
      const currentAssetCount =
        tab === "images" ? tabData.images?.images.length : tabData.analytics?.analyticsFiles.length
      const assetTotalCount =
        tab === "images" ? tabData.images?.assetTotalCount : tabData.analytics?.assetTotalCount

      if (
        typeof currentAssetCount !== "number" ||
        typeof assetTotalCount !== "number" ||
        currentAssetCount >= assetTotalCount ||
        loadingMoreAssetTab
      ) {
        return
      }

      const requestVersion = requestVersionRef.current
      setLoadingMoreAssetTab(tab)

      try {
        const nextTabData = await fetchSessionDetailTabData({
          assetOffset: currentAssetCount,
          scope: input.scope,
          sessionId: input.sessionId,
          tab,
        })

        if (requestVersion !== requestVersionRef.current) {
          return
        }

        setTabData((currentState) =>
          appendSessionAssetTabData({
            data: nextTabData,
            state: currentState,
            tab,
          }),
        )
      } catch {
        if (requestVersion === requestVersionRef.current) {
          toast.error("Could not load more assets.")
        }
      } finally {
        if (requestVersion === requestVersionRef.current) {
          setLoadingMoreAssetTab(null)
        }
      }
    },
    [input.scope, input.sessionId, loadingMoreAssetTab, tabData.analytics, tabData.images],
  )

  function renderPendingTab(tab: SessionDetailTab) {
    if (loadError?.tab === tab) {
      return <SessionTabDataError error={loadError} onRetry={retrySelectedTab} />
    }

    return <SessionDynamicPanelFallback />
  }

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
            {tabData.info ? (
              <SessionInfoPanel
                sessionId={input.sessionId}
                scope={input.scope}
                info={tabData.info.info}
                availableStandardMoves={tabData.info.availableStandardMoves}
                linkedStandardMoveIds={tabData.info.linkedStandardMoveIds}
                standardMoveCatalogPage={tabData.info.standardMoveCatalogPage}
                availableWindPatterns={tabData.info.availableWindPatterns}
                linkedWindPatternIds={tabData.info.linkedWindPatternIds}
                windPatternCatalogPage={tabData.info.windPatternCatalogPage}
                canManageSession={input.canManageSession}
              />
            ) : (
              renderPendingTab("info")
            )}
          </TabsContent>
        ) : null}

        {selectedTab === "goals" ? (
          <TabsContent value="goals" className="space-y-4">
            {tabData.goals ? (
              <GoalsPanel
                sessionId={input.sessionId}
                scope={input.scope}
                goals={tabData.goals.goals}
                canManageSession={input.canManageSession}
              />
            ) : (
              renderPendingTab("goals")
            )}
          </TabsContent>
        ) : null}

        {selectedTab === "results" ? (
          <TabsContent value="results" className="space-y-4">
            {tabData.results ? (
              <ResultsPanel
                sessionId={input.sessionId}
                scope={input.scope}
                resultNotes={tabData.results.results.resultNotes}
                canManageSession={input.canManageSession}
              />
            ) : (
              renderPendingTab("results")
            )}
          </TabsContent>
        ) : null}

        {selectedTab === "images" ? (
          <TabsContent value="images" className="space-y-4">
            {tabData.images ? (
              <SessionAssetsPanel
                title="Images"
                sessionId={input.sessionId}
                scope={input.scope}
                assetType="photo"
                tab="images"
                accept="image/*"
                buttonLabel="Upload image"
                assets={tabData.images.images}
                assetLimit={tabData.images.assetLimit}
                assetTotalCount={tabData.images.assetTotalCount}
                emptyMessage="No images uploaded for this session yet."
                isLoadingMore={loadingMoreAssetTab === "images"}
                onLoadMore={() => void loadMoreAssets("images")}
                canManageSession={input.canManageSession}
              />
            ) : (
              renderPendingTab("images")
            )}
          </TabsContent>
        ) : null}

        {selectedTab === "analytics" ? (
          <TabsContent value="analytics" className="space-y-4">
            {tabData.analytics ? (
              <SessionAssetsPanel
                title="Analytics"
                sessionId={input.sessionId}
                scope={input.scope}
                assetType="analytics_file"
                tab="analytics"
                accept="application/pdf,.pdf"
                buttonLabel="Upload PDF"
                assets={tabData.analytics.analyticsFiles}
                assetLimit={tabData.analytics.assetLimit}
                assetTotalCount={tabData.analytics.assetTotalCount}
                emptyMessage="No analytics PDFs uploaded for this session yet."
                isLoadingMore={loadingMoreAssetTab === "analytics"}
                onLoadMore={() => void loadMoreAssets("analytics")}
                canManageSession={input.canManageSession}
              />
            ) : (
              renderPendingTab("analytics")
            )}
          </TabsContent>
        ) : null}

        {selectedTab === "gear" ? (
          <TabsContent value="gear" className="space-y-4">
            {tabData.gear ? (
              <SessionGearTabPanel
                sessionId={input.sessionId}
                scope={input.scope}
                gearCatalogPage={tabData.gear.gearCatalogPage}
                gearItems={tabData.gear.gearItems}
                gearType={tabData.gear.gearType}
                linkedGearItemIds={tabData.gear.linkedGearItemIds}
                canManageSession={input.canManageSession}
              />
            ) : (
              renderPendingTab("gear")
            )}
          </TabsContent>
        ) : null}
      </section>
    </Tabs>
  )
}
