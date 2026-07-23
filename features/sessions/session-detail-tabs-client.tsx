"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2Icon, MinusIcon, PlayIcon, PlusIcon, Settings2Icon } from "lucide-react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import { SessionDetailPanelSkeleton } from "@/components/shared/page-skeletons"
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
import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import {
  readScopedRouteCache,
  SCOPED_ROUTE_DETAIL_TAB_STALE_MS,
  writeScopedRouteCache,
  type ScopedRouteCacheScope,
} from "@/features/shared/scoped-route-cache"
import { updateSessionDetailAction } from "@/features/sessions/detail-actions"
import {
  invalidateSessionAssetRouteCache,
  invalidateSessionDetailRouteCache,
  invalidateSessionMutationRouteCache,
  type SessionAssetCacheTab,
  type SessionDetailCacheTab,
} from "@/features/shared/scoped-route-cache-invalidation"
import { useStaleRouteData } from "@/features/shared/use-stale-route-data"
import type { SessionAssetsPanelProps } from "@/features/sessions/detail/assets-panel"
import type { SessionGearTabPanelProps } from "@/features/sessions/detail/gear-panel"
import type {
  SessionGpsFilesPanelProps,
  SessionGpsFilePlayerDialogProps,
} from "@/features/sessions/detail/gps-files-panel"
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
  SessionDetailGpsFile,
  SessionDetailImagesTabData,
  SessionDetailInfoTabData,
  SessionDetailResultsTabData,
  SessionDetailSetupData,
  SessionDetailTabPayload,
} from "@/features/sessions/detail-types"
import {
  buildSessionDetailHref,
  SESSION_DETAIL_TABS,
  type SessionDetailTab,
} from "@/features/sessions/navigation"
import {
  buildSessionDetailTabApiUrl,
  buildSessionDetailTabCacheMetadata,
  isSessionAssetTab,
  SESSION_DETAIL_ASSET_TAB_MAX_AGE_MS,
  SESSION_DETAIL_ASSET_TAB_STALE_MS,
  SESSION_DETAIL_TAB_CACHE_ROUTE,
  type SessionDetailTabRequestInput,
} from "@/features/sessions/session-detail-tab-cache"
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
        className="mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
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
  { loading: () => <SessionDynamicPanelFallback selectedTab="info" /> },
)

const GoalsPanel = dynamic<GoalsPanelProps>(
  () => import("@/features/sessions/detail/goals-panel").then((module) => module.GoalsPanel),
  { loading: () => <SessionDynamicPanelFallback selectedTab="goals" /> },
)

const ResultsPanel = dynamic<ResultsPanelProps>(
  () => import("@/features/sessions/detail/results-panel").then((module) => module.ResultsPanel),
  { loading: () => <SessionDynamicPanelFallback selectedTab="results" /> },
)

const SessionAssetsPanel = dynamic<SessionAssetsPanelProps>(
  () => import("@/features/sessions/detail/assets-panel").then((module) => module.SessionAssetsPanel),
  { loading: () => <SessionDynamicPanelFallback selectedTab="images" /> },
)

const SessionGpsFilesPanel = dynamic<SessionGpsFilesPanelProps>(
  () =>
    import("@/features/sessions/detail/gps-files-panel").then(
      (module) => module.SessionGpsFilesPanel,
    ),
  { loading: () => <SessionDynamicPanelFallback selectedTab="analytics" /> },
)

const SessionGpsFilePlayerDialog = dynamic<SessionGpsFilePlayerDialogProps>(
  () =>
    import("@/features/sessions/detail/gps-files-panel").then(
      (module) => module.SessionGpsFilePlayerDialog,
    ),
  { loading: () => null },
)

const SessionGearTabPanel = dynamic<SessionGearTabPanelProps>(
  () => import("@/features/sessions/detail/gear-panel").then((module) => module.SessionGearTabPanel),
  { loading: () => <SessionDynamicPanelFallback selectedTab="gear" /> },
)

function SessionDynamicPanelFallback({
  selectedTab,
}: {
  selectedTab: SessionDetailTab
}) {
  return <SessionDetailPanelSkeleton selectedTab={selectedTab} />
}


function EditSessionMetadataDialog(input: {
  sessionId: string
  scope: NavigationScope
  sessionType: "training" | "regatta"
  sessionDate: string
  campStartDate: string
  campEndDate: string
  dockOutAt: string | null
  dockInAt: string | null
  netTimeMinutes: number | null
}) {
  function EditSessionDialogSubmitButton(props: {
    className?: string
    disabled?: boolean
  }) {
    const { pending } = useFormStatus()

    return (
      <Button type="submit" disabled={pending || props.disabled} className={props.className}>
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
  const hasSessionDateRangeError =
    nextSessionDate.length > 0 &&
    (nextSessionDate < input.campStartDate || nextSessionDate > input.campEndDate)

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
                  lang="en-US"
                  min={input.campStartDate}
                  max={input.campEndDate}
                  value={nextSessionDate}
                  onChange={(event) => setNextSessionDate(event.target.value)}
                  aria-invalid={hasSessionDateRangeError}
                  aria-describedby={
                    hasSessionDateRangeError
                      ? `session-date-${input.sessionId}-error`
                      : undefined
                  }
                />
                {hasSessionDateRangeError ? (
                  <p
                    id={`session-date-${input.sessionId}-error`}
                    className="text-sm text-destructive"
                  >
                    Date must be within the camp range.
                  </p>
                ) : null}
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
          <EditSessionDialogSubmitButton
            className="h-11 w-full"
            disabled={hasSessionDateRangeError}
          />
        </DrawerFooter>
      ) : (
        <SheetFooter className="shrink-0 border-t">
          <EditSessionDialogSubmitButton
            className="w-full"
            disabled={hasSessionDateRangeError}
          />
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

export function SessionHeaderGpsPlayerAction(input: {
  canManageSession: boolean
  gpsFile: SessionDetailGpsFile | null
  scope: NavigationScope
  sessionId: string
}) {
  const router = useRouter()
  const [playerOpen, setPlayerOpen] = React.useState(false)
  const hasGpsFile = Boolean(input.gpsFile)

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={hasGpsFile ? "default" : "outline"}
        className={cn(
          "h-6 rounded-full px-2 text-[0.7rem] font-medium",
          !hasGpsFile &&
            "border-border bg-muted text-muted-foreground shadow-none hover:bg-muted hover:text-muted-foreground",
        )}
        aria-disabled={!hasGpsFile}
        aria-label={hasGpsFile ? "Open Vakaros player" : "Open Files tab"}
        onClick={() => {
          if (!input.gpsFile) {
            router.push(
              buildSessionDetailHref({
                scope: input.scope,
                sessionId: input.sessionId,
                tab: "analytics",
              }),
            )
            return
          }

          setPlayerOpen(true)
        }}
      >
        GPS
        <PlayIcon className="ml-0.5 size-3" />
      </Button>

      {input.gpsFile ? (
        <SessionGpsFilePlayerDialog
          canManageSession={input.canManageSession}
          gpsFile={input.gpsFile}
          open={playerOpen}
          onOpenChange={setPlayerOpen}
          scope={input.scope}
          sessionId={input.sessionId}
        />
      ) : null}
    </>
  )
}

export function SessionHeaderActions(input: {
  sessionId: string
  scope: NavigationScope
  sessionType: "training" | "regatta"
  sessionDate: string
  campStartDate: string
  campEndDate: string
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
        campStartDate={input.campStartDate}
        campEndDate={input.campEndDate}
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
  cache: ApiSliceCacheMetadata
  data: SessionDetailTabPayload
  tab: SessionDetailTab
}

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
      gpsFiles: nextData.gpsFiles,
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

function getAffectedSessionTabsForStatus(
  status: string | null,
  selectedTab: SessionDetailTab,
): Set<SessionDetailTab> {
  if (status === "updated" || status === "info_updated") {
    return new Set(["info"])
  }

  if (status === "goals_updated") {
    return new Set(["goals"])
  }

  if (status === "results_updated") {
    return new Set(["results"])
  }

  if (
    status === "setup_updated" ||
    status === "setup_metric_created" ||
    status === "setup_metric_updated" ||
    status === "setup_metric_deleted" ||
    status === "setup_metrics_reordered"
  ) {
    return new Set(["info"])
  }

  if (status === "gear_updated") {
    return new Set(["gear"])
  }

  if (status === "asset_uploaded" || status === "asset_deleted") {
    if (selectedTab === "images" || selectedTab === "analytics") {
      return new Set([selectedTab])
    }

    return new Set(["images", "analytics"])
  }

  return new Set()
}

function invalidateSessionDetailTabDataState(input: {
  affectedTabs: Set<SessionDetailTab>
  state: SessionDetailTabDataState
}): SessionDetailTabDataState {
  if (input.affectedTabs.size === 0) {
    return input.state
  }

  return {
    ...input.state,
    info: input.affectedTabs.has("info") ? undefined : input.state.info,
    results: input.affectedTabs.has("results") ? undefined : input.state.results,
    images: input.affectedTabs.has("images") ? undefined : input.state.images,
    analytics: input.affectedTabs.has("analytics") ? undefined : input.state.analytics,
    gear: input.affectedTabs.has("gear") ? undefined : input.state.gear,
  }
}

function resolveCacheScope(scope: NavigationScope): ScopedRouteCacheScope {
  return {
    orgId: scope.activeOrgId,
    teamId: scope.activeTeamId,
  }
}

function buildSessionDetailTabRequest(input: {
  assetOffset?: number
  catalogOffset?: number
  scope: NavigationScope
  sessionId: string
  tab: SessionDetailTab
}): SessionDetailTabRequestInput {
  return {
    assetOffset: isSessionAssetTab(input.tab) ? Math.max(0, input.assetOffset ?? 0) : 0,
    catalogOffset: isSessionAssetTab(input.tab)
      ? 0
      : Math.max(0, input.catalogOffset ?? 0),
    scope: input.scope,
    sessionId: input.sessionId,
    tab: input.tab,
  }
}

function buildSessionDetailTabCacheFromRequest(input: {
  cacheScope: ScopedRouteCacheScope
  request: SessionDetailTabRequestInput
}): ApiSliceCacheMetadata {
  return buildSessionDetailTabCacheMetadata({
    assetOffset: input.request.assetOffset,
    catalogOffset: input.request.catalogOffset,
    scope: input.cacheScope,
    sessionId: input.request.sessionId,
    tab: input.request.tab,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isApiSliceCacheMetadata(value: unknown): value is ApiSliceCacheMetadata {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.key === "string" &&
    typeof value.scopeKey === "string" &&
    typeof value.route === "string" &&
    typeof value.filters === "string" &&
    "entityId" in value &&
    "tab" in value
  )
}

function isSessionDetailTabPayload(
  value: unknown,
  tab: SessionDetailTab,
): value is SessionDetailTabPayload {
  if (!isRecord(value)) {
    return false
  }

  if (tab === "info") {
    return (
      isRecord(value.info) &&
      Array.isArray(value.availableStandardMoves) &&
      Array.isArray(value.linkedStandardMoveIds) &&
      isRecord(value.standardMoveCatalogPage) &&
      Array.isArray(value.availableWindPatterns) &&
      Array.isArray(value.linkedWindPatternIds) &&
      isRecord(value.windPatternCatalogPage)
    )
  }

  if (tab === "goals") {
    return typeof value.goals === "string" || value.goals === null
  }

  if (tab === "results") {
    return isRecord(value.results)
  }

  if (tab === "images") {
    return (
      Array.isArray(value.images) &&
      typeof value.assetLimit === "number" &&
      typeof value.assetOffset === "number" &&
      typeof value.assetTotalCount === "number"
    )
  }

  if (tab === "analytics") {
    return (
      Array.isArray(value.analyticsFiles) &&
      Array.isArray(value.gpsFiles) &&
      typeof value.assetLimit === "number" &&
      typeof value.assetOffset === "number" &&
      typeof value.assetTotalCount === "number" &&
      typeof value.gpsFileTotalCount === "number"
    )
  }

  return (
    Array.isArray(value.gearItems) &&
    Array.isArray(value.linkedGearItemIds) &&
    isRecord(value.gearCatalogPage) &&
    typeof value.gearType === "string"
  )
}

function isSessionDetailTabDataResponse(
  value: unknown,
  tab: SessionDetailTab,
): value is SessionDetailTabDataResponse {
  if (!isRecord(value)) {
    return false
  }

  return (
    isApiSliceCacheMetadata(value.cache) &&
    value.tab === tab &&
    isSessionDetailTabPayload(value.data, tab)
  )
}

function doesSessionDetailCacheMetadataMatch(input: {
  cache: ApiSliceCacheMetadata
  expectedCache: ApiSliceCacheMetadata
  expectedTab: SessionDetailTab
}): boolean {
  return (
    input.cache.key === input.expectedCache.key &&
    input.cache.scopeKey === input.expectedCache.scopeKey &&
    input.cache.route === SESSION_DETAIL_TAB_CACHE_ROUTE &&
    String(input.cache.entityId) === String(input.expectedCache.entityId) &&
    input.cache.tab === input.expectedTab &&
    input.cache.filters === input.expectedCache.filters
  )
}

function isValidSessionDetailTabResponse(input: {
  expectedCache: ApiSliceCacheMetadata
  expectedTab: SessionDetailTab
  payload: SessionDetailTabDataResponse
}): boolean {
  return (
    doesSessionDetailCacheMetadataMatch({
      cache: input.payload.cache,
      expectedCache: input.expectedCache,
      expectedTab: input.expectedTab,
    }) && isSessionDetailTabPayload(input.payload.data, input.expectedTab)
  )
}

function buildInitialSessionDetailTabResponse(input: {
  cache: ApiSliceCacheMetadata
  initialTab: SessionDetailTab
  initialTabData: SessionDetailTabPayload
  selectedTab: SessionDetailTab
}): SessionDetailTabDataResponse | null {
  if (input.selectedTab !== input.initialTab || input.cache.tab !== input.initialTab) {
    return null
  }

  return {
    cache: input.cache,
    data: input.initialTabData,
    tab: input.initialTab,
  }
}

function getSessionDetailTabCachePolicy(tab: SessionDetailTab): {
  maxAgeMs?: number
  staleMs: number
} {
  if (isSessionAssetTab(tab)) {
    return {
      maxAgeMs: SESSION_DETAIL_ASSET_TAB_MAX_AGE_MS,
      staleMs: SESSION_DETAIL_ASSET_TAB_STALE_MS,
    }
  }

  return {
    staleMs: SCOPED_ROUTE_DETAIL_TAB_STALE_MS,
  }
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
  catalogOffset?: number
  scope: NavigationScope
  sessionId: string
  signal?: AbortSignal
  tab: SessionDetailTab
}): Promise<SessionDetailTabDataResponse> {
  const response = await fetch(buildSessionDetailTabApiUrl(
    buildSessionDetailTabRequest({
      assetOffset: input.assetOffset,
      catalogOffset: input.catalogOffset,
      scope: input.scope,
      sessionId: input.sessionId,
      tab: input.tab,
    }),
  ), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal: input.signal,
  })

  if (!response.ok) {
    throw new Error(await resolveSessionDetailTabErrorMessage(response))
  }

  const payload = (await response.json()) as unknown

  if (!isSessionDetailTabDataResponse(payload, input.tab)) {
    throw new Error("The loaded tab data did not match the selected tab.")
  }

  return payload
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
  campId: string
  initialTab: SessionDetailTab
  initialTabData: SessionDetailTabPayload
  scope: NavigationScope
  sessionId: string
  sessionType: "training" | "regatta"
  teamVenueId: string
  goals: string | null
  canManageSession: boolean
  canUploadSessionAssets: boolean
  sessionAssetUploadBlockReason?: "plan_limit_reached" | "payment_required" | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = searchParams.get("status")
  const scopeKey = `${input.scope.activeOrgId}:${input.scope.activeTeamId ?? ""}`
  const cacheScope = React.useMemo(() => resolveCacheScope(input.scope), [input.scope])
  const [selectedTab, setSelectedTab] = React.useState<SessionDetailTab>(input.initialTab)
  const [tabData, setTabData] = React.useState<SessionDetailTabDataState>(() =>
    buildSessionDetailTabDataState({
      goals: input.goals,
      initialTab: input.initialTab,
      initialTabData: input.initialTabData,
    }),
  )
  const [loadingMoreAssetTab, setLoadingMoreAssetTab] = React.useState<SessionAssetTab | null>(
    null,
  )
  const warmInFlightTabsRef = React.useRef<Set<string>>(new Set())
  const requestVersionRef = React.useRef(0)
  const sessionIdRef = React.useRef(input.sessionId)
  const scopeKeyRef = React.useRef(scopeKey)

  const updateSelectedTab = React.useCallback(
    (tab: SessionDetailTab) => {
      setSelectedTab(tab)

      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set("tab", tab)

      const nextSearch = nextParams.toString()
      const nextUrl = `${pathname}${nextSearch.length > 0 ? `?${nextSearch}` : ""}${
        window.location.hash
      }`

      window.history.replaceState(null, "", nextUrl)
    },
    [pathname, searchParams],
  )

  React.useEffect(() => {
    const didSessionChange = sessionIdRef.current !== input.sessionId
    const didScopeChange = scopeKeyRef.current !== scopeKey
    sessionIdRef.current = input.sessionId
    scopeKeyRef.current = scopeKey

    requestVersionRef.current += 1
    warmInFlightTabsRef.current.clear()
    if (didSessionChange || didScopeChange) {
      setSelectedTab(input.initialTab)
    }

    setTabData((currentState) =>
      applySessionDetailTabData({
        data: input.initialTabData,
        state:
          didSessionChange || didScopeChange
            ? {
                goals: {
                  goals: input.goals,
                },
              }
            : invalidateSessionDetailTabDataState({
                affectedTabs: getAffectedSessionTabsForStatus(status, input.initialTab),
                state: {
                  ...currentState,
                  goals: {
                    goals: input.goals,
                  },
                },
              }),
        tab: input.initialTab,
      }),
    )
    setLoadingMoreAssetTab(null)
  }, [
    input.goals,
    input.initialTab,
    input.initialTabData,
    input.sessionId,
    scopeKey,
    status,
  ])

  React.useEffect(() => {
    const affectedTabs = [...getAffectedSessionTabsForStatus(status, input.initialTab)]

    if (affectedTabs.length === 0) {
      return
    }

    invalidateSessionDetailRouteCache({
      scope: input.scope,
      sessionId: input.sessionId,
      tabs: affectedTabs as SessionDetailCacheTab[],
    })

    if (status === "updated") {
      invalidateSessionMutationRouteCache({
        scope: input.scope,
        sessionId: input.sessionId,
        campId: input.campId,
        teamVenueId: input.teamVenueId,
      })
    }
  }, [
    input.campId,
    input.initialTab,
    input.scope,
    input.sessionId,
    input.teamVenueId,
    status,
  ])

  const selectedTabRequest = React.useMemo(
    () =>
      buildSessionDetailTabRequest({
        scope: input.scope,
        sessionId: input.sessionId,
        tab: selectedTab,
      }),
    [input.scope, input.sessionId, selectedTab],
  )
  const selectedTabCache = React.useMemo(
    () =>
      buildSessionDetailTabCacheFromRequest({
        cacheScope,
        request: selectedTabRequest,
      }),
    [cacheScope, selectedTabRequest],
  )
  const selectedInitialPayload = React.useMemo(
    () =>
      buildInitialSessionDetailTabResponse({
        cache: selectedTabCache,
        initialTab: input.initialTab,
        initialTabData: input.initialTabData,
        selectedTab,
      }),
    [input.initialTab, input.initialTabData, selectedTab, selectedTabCache],
  )
  const selectedCachePolicy = React.useMemo(
    () => getSessionDetailTabCachePolicy(selectedTab),
    [selectedTab],
  )
  const fetchFreshTabData = React.useCallback(
    async ({ signal }: { signal: AbortSignal }) =>
      fetchSessionDetailTabData({
        assetOffset: selectedTabRequest.assetOffset,
        catalogOffset: selectedTabRequest.catalogOffset,
        scope: selectedTabRequest.scope,
        sessionId: selectedTabRequest.sessionId,
        signal,
        tab: selectedTabRequest.tab,
      }),
    [selectedTabRequest],
  )
  const validateFreshPayload = React.useCallback(
    (payload: SessionDetailTabDataResponse) =>
      isValidSessionDetailTabResponse({
        expectedCache: selectedTabCache,
        expectedTab: selectedTab,
        payload,
      }),
    [selectedTab, selectedTabCache],
  )
  const routeData = useStaleRouteData<SessionDetailTabDataResponse>({
    cacheKey: selectedTabCache.key,
    scope: cacheScope,
    staleMs: selectedCachePolicy.staleMs,
    maxAgeMs: selectedCachePolicy.maxAgeMs,
    initialData: selectedInitialPayload,
    enabled: input.scope.activeTeamId !== null,
    fetchFreshData: fetchFreshTabData,
    validateFreshPayload,
  })

  React.useEffect(() => {
    const payload = routeData.data

    if (!payload) {
      return
    }

    setTabData((currentState) =>
      applySessionDetailTabData({
        data: payload.data,
        state: currentState,
        tab: payload.tab,
      }),
    )
  }, [routeData.data])

  React.useEffect(() => {
    if (input.scope.activeTeamId === null) {
      return
    }

    const infoRequest = buildSessionDetailTabRequest({
      scope: input.scope,
      sessionId: input.sessionId,
      tab: "info",
    })
    const infoCache = buildSessionDetailTabCacheFromRequest({
      cacheScope,
      request: infoRequest,
    })

    if (
      infoCache.key === selectedTabCache.key ||
      warmInFlightTabsRef.current.has(infoCache.key)
    ) {
      return
    }

    const cachedInfo = readScopedRouteCache<SessionDetailTabDataResponse>({
      key: infoCache.key,
      scope: cacheScope,
    })

    if (cachedInfo.status === "hit" && !cachedInfo.isStale) {
      return
    }

    const controller = new AbortController()
    warmInFlightTabsRef.current.add(infoCache.key)

    void fetchSessionDetailTabData({
      scope: infoRequest.scope,
      sessionId: infoRequest.sessionId,
      signal: controller.signal,
      tab: infoRequest.tab,
    })
      .then((payload) => {
        if (
          controller.signal.aborted ||
          !isValidSessionDetailTabResponse({
            expectedCache: infoCache,
            expectedTab: "info",
            payload,
          })
        ) {
          return
        }

        writeScopedRouteCache({
          key: infoCache.key,
          scope: cacheScope,
          payload,
          staleMs: SCOPED_ROUTE_DETAIL_TAB_STALE_MS,
        })
      })
      .catch(() => {
        // Warm failures should never interrupt the visible tab.
      })
      .finally(() => {
        warmInFlightTabsRef.current.delete(infoCache.key)
      })

    return () => {
      controller.abort()
    }
  }, [cacheScope, input.scope, input.sessionId, selectedTabCache.key])

  const retrySelectedTab = routeData.retry
  const refreshSelectedTab = routeData.refresh
  const hasSelectedTabData =
    selectedTab === "info"
      ? typeof tabData.info !== "undefined"
      : selectedTab === "goals"
        ? typeof tabData.goals !== "undefined"
        : selectedTab === "results"
          ? typeof tabData.results !== "undefined"
          : selectedTab === "images"
            ? typeof tabData.images !== "undefined"
            : selectedTab === "analytics"
              ? typeof tabData.analytics !== "undefined"
              : typeof tabData.gear !== "undefined"
  const showInlineError = routeData.status === "error" && hasSelectedTabData
  const isSelectedTabRevalidating = routeData.isRevalidating && hasSelectedTabData

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
            data: nextTabData.data,
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

  const handleAssetsChanged = React.useCallback(
    async (tab: SessionAssetTab) => {
      invalidateSessionAssetRouteCache({
        scope: input.scope,
        sessionId: input.sessionId,
        tabs: [tab as SessionAssetCacheTab],
      })

      if (selectedTab !== tab) {
        refreshSelectedTab()
        if (tab === "analytics") {
          router.refresh()
        }
        return
      }

      const requestVersion = requestVersionRef.current
      const nextTabData = await fetchSessionDetailTabData({
        scope: input.scope,
        sessionId: input.sessionId,
        tab,
      })

      if (
        requestVersion !== requestVersionRef.current ||
        !isValidSessionDetailTabResponse({
          expectedCache: selectedTabCache,
          expectedTab: tab,
          payload: nextTabData,
        })
      ) {
        return
      }

      setTabData((currentState) =>
        applySessionDetailTabData({
          data: nextTabData.data,
          state: currentState,
          tab,
        }),
      )
      writeScopedRouteCache({
        key: selectedTabCache.key,
        scope: cacheScope,
        payload: nextTabData,
        staleMs: SESSION_DETAIL_ASSET_TAB_STALE_MS,
        maxAgeMs: SESSION_DETAIL_ASSET_TAB_MAX_AGE_MS,
      })
      if (tab === "analytics") {
        router.refresh()
      }
    },
    [
      cacheScope,
      input.scope,
      input.sessionId,
      refreshSelectedTab,
      router,
      selectedTab,
      selectedTabCache,
    ],
  )

  function renderPendingTab(tab: SessionDetailTab) {
    if (routeData.status === "error" && !routeData.hasData) {
      return (
        <SessionTabDataError
          error={{
            message: routeData.error?.message ?? "Could not load this tab.",
            tab,
          }}
          onRetry={retrySelectedTab}
        />
      )
    }

    return <SessionDetailPanelSkeleton selectedTab={tab} />
  }

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => updateSelectedTab(resolveSessionDetailTab(value))}
      className="space-y-4"
    >
      <div className="md:hidden">
        <MobileSessionDetailTabsList selectedTab={selectedTab} onTabChange={updateSelectedTab} />
      </div>

      <TabsList className="hidden h-10 md:inline-flex">
        {SESSION_DETAIL_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="min-w-fit capitalize">
            {formatSessionDetailTabLabel(tab)}
          </TabsTrigger>
        ))}
      </TabsList>

      <section className="relative rounded-xl border bg-card p-4 sm:p-6">
        {showInlineError ? (
          <div
            role="alert"
            className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:flex-row md:items-center md:justify-between"
          >
            <span>{routeData.error?.message ?? "Could not refresh this tab."}</span>
            <Button type="button" variant="outline" size="sm" onClick={retrySelectedTab}>
              Retry
            </Button>
          </div>
        ) : null}

        <div
          className={cn(
            "transition-opacity",
            isSelectedTabRevalidating && "opacity-75",
          )}
        >
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
                  onAssetsChanged={() => handleAssetsChanged("images")}
                  canManageSession={input.canManageSession}
                  canUploadAssets={input.canUploadSessionAssets}
                  assetUploadBlockReason={input.sessionAssetUploadBlockReason}
                />
              ) : (
                renderPendingTab("images")
              )}
            </TabsContent>
          ) : null}

          {selectedTab === "analytics" ? (
            <TabsContent value="analytics" className="space-y-4">
              {tabData.analytics ? (
                <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                  <SessionAssetsPanel
                    title="PDF Files"
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
                    onAssetsChanged={() => handleAssetsChanged("analytics")}
                    canManageSession={input.canManageSession}
                    canUploadAssets={input.canUploadSessionAssets}
                    assetUploadBlockReason={input.sessionAssetUploadBlockReason}
                  />
                  <SessionGpsFilesPanel
                    sessionId={input.sessionId}
                    scope={input.scope}
                    gpsFiles={tabData.analytics.gpsFiles}
                    gpsFileTotalCount={tabData.analytics.gpsFileTotalCount}
                    emptyMessage="No Vakaros uploaded for this session yet."
                    onGpsFilesChanged={() => handleAssetsChanged("analytics")}
                    canManageSession={input.canManageSession}
                    canUploadAssets={input.canUploadSessionAssets}
                    assetUploadBlockReason={input.sessionAssetUploadBlockReason}
                  />
                </div>
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
        </div>

        {isSelectedTabRevalidating ? (
          <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border bg-background/90 p-2 text-muted-foreground shadow-sm">
            <Loader2Icon className="size-4 animate-spin" />
            <span className="sr-only">Refreshing {formatSessionDetailTabLabel(selectedTab)}</span>
          </div>
        ) : null}
      </section>
    </Tabs>
  )
}
