"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { CampDetailPanelSkeleton } from "@/components/shared/page-skeletons"
import { GradientCard } from "@/components/shared/gradient-card"
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { confirmCampGoalsNotificationAction } from "@/features/camps/actions"
import {
  buildCampDetailTabApiUrl,
  buildCampDetailTabCacheMetadata,
  CAMP_DETAIL_TAB_CACHE_ROUTE,
  type CampDetailTabRequestInput,
} from "@/features/camps/camp-detail-tab-cache"
import { CampGoalsEditSurface } from "@/features/camps/detail/camp-goals-edit-surface"
import type {
  CampDetailGoalsTabData,
  CampDetailKpi,
  CampDetailNotesTabData,
  CampDetailSessionsTabData,
  CampDetailTab,
  CampDetailTabPayload,
} from "@/features/camps/detail-types"
import { buildCampDetailHref, CAMP_DETAIL_TABS } from "@/features/camps/navigation"
import type { ApiSliceCacheMetadata } from "@/features/shared/api-slice-contracts"
import {
  readScopedRouteCache,
  SCOPED_ROUTE_DETAIL_TAB_STALE_MS,
  writeScopedRouteCache,
  type ScopedRouteCacheScope,
} from "@/features/shared/scoped-route-cache"
import { useStaleRouteData } from "@/features/shared/use-stale-route-data"
import type { TeamSessionHighlightFilter } from "@/features/sessions/data"
import { CreateSessionDialog } from "@/features/sessions/session-form-dialogs"
import { TeamSessionsTable } from "@/features/sessions/sessions-table"
import { TeamSessionsToolbar } from "@/features/sessions/team-sessions-toolbar"
import { cn } from "@/lib/utils"
import type { NavigationScope } from "@/lib/navigation/types"

type CampDetailTabDataResponse = {
  cache: ApiSliceCacheMetadata
  data: CampDetailTabPayload
  tab: CampDetailTab
}

type CampDetailTabErrorPayload = {
  detail?: unknown
  error?: unknown
}

type CampDetailTabLoadError = {
  message: string
  tab: CampDetailTab
}

type NotesAppendState = {
  cacheKey: string
  data: CampDetailNotesTabData
}

function clearCampGoalNotificationPromptParam(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete("notifyCampGoals")
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
}

function resolveTab(value: string): CampDetailTab {
  return CAMP_DETAIL_TABS.includes(value as CampDetailTab)
    ? (value as CampDetailTab)
    : "sessions"
}

function renderNoteValue(value: string | null): string {
  if (!value) {
    return "—"
  }

  return value
}

function appendUniqueNotesCards(input: {
  currentCards: CampDetailNotesTabData["notesCards"]
  nextCards: CampDetailNotesTabData["notesCards"]
}): CampDetailNotesTabData["notesCards"] {
  const seenSessionIds = new Set(input.currentCards.map((card) => card.sessionId))
  const uniqueNextCards = input.nextCards.filter((card) => {
    if (seenSessionIds.has(card.sessionId)) {
      return false
    }

    seenSessionIds.add(card.sessionId)
    return true
  })

  return [...input.currentCards, ...uniqueNextCards]
}

function appendCampDetailNotesTabData(input: {
  currentNotes: CampDetailNotesTabData
  nextData: CampDetailTabPayload
}): CampDetailNotesTabData {
  const nextData = input.nextData as CampDetailNotesTabData

  return {
    ...nextData,
    notesCards: appendUniqueNotesCards({
      currentCards: input.currentNotes.notesCards,
      nextCards: nextData.notesCards,
    }),
    sessionOffset: input.currentNotes.sessionOffset,
  }
}

function resolveCacheScope(scope: NavigationScope): ScopedRouteCacheScope {
  return {
    orgId: scope.activeOrgId,
    teamId: scope.activeTeamId,
  }
}

function buildCampDetailTabRequest(input: {
  campId: string
  highlight?: TeamSessionHighlightFilter
  loadMore: boolean
  notesOffset: number
  page: number
  scope: NavigationScope
  tab: CampDetailTab
}): CampDetailTabRequestInput {
  if (input.tab === "sessions") {
    return {
      campId: input.campId,
      highlight: input.highlight,
      loadMore: input.loadMore,
      notesOffset: 0,
      page: input.page,
      scope: input.scope,
      tab: input.tab,
    }
  }

  if (input.tab === "notes") {
    return {
      campId: input.campId,
      loadMore: false,
      notesOffset: input.notesOffset,
      page: 1,
      scope: input.scope,
      tab: input.tab,
    }
  }

  return {
    campId: input.campId,
    loadMore: false,
    notesOffset: 0,
    page: 1,
    scope: input.scope,
    tab: input.tab,
  }
}

function buildCampDetailTabCacheFromRequest(input: {
  cacheScope: ScopedRouteCacheScope
  request: CampDetailTabRequestInput
}): ApiSliceCacheMetadata {
  return buildCampDetailTabCacheMetadata({
    campId: input.request.campId,
    highlight: input.request.highlight,
    loadMore: input.request.loadMore,
    notesOffset: input.request.notesOffset,
    page: input.request.page,
    scope: input.cacheScope,
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
    "tab" in value &&
    "page" in value
  )
}

function isCampDetailTabPayload(
  value: unknown,
  tab: CampDetailTab,
): value is CampDetailTabPayload {
  if (!isRecord(value)) {
    return false
  }

  if (tab === "sessions") {
    return (
      Array.isArray(value.sessions) &&
      Array.isArray(value.campOptions) &&
      typeof value.currentPage === "number" &&
      typeof value.pageCount === "number" &&
      typeof value.hasPreviousPage === "boolean" &&
      typeof value.hasNextPage === "boolean"
    )
  }

  if (tab === "goals") {
    return typeof value.goals === "string" || value.goals === null
  }

  return (
    Array.isArray(value.notesCards) &&
    typeof value.sessionLimit === "number" &&
    typeof value.sessionOffset === "number" &&
    typeof value.sessionTotalCount === "number" &&
    (typeof value.nextSessionOffset === "number" || value.nextSessionOffset === null)
  )
}

function isCampDetailTabDataResponse(
  value: unknown,
  tab: CampDetailTab,
): value is CampDetailTabDataResponse {
  if (!isRecord(value)) {
    return false
  }

  return (
    isApiSliceCacheMetadata(value.cache) &&
    value.tab === tab &&
    isCampDetailTabPayload(value.data, tab)
  )
}

function doesCampDetailCacheMetadataMatch(input: {
  cache: ApiSliceCacheMetadata
  expectedCache: ApiSliceCacheMetadata
  expectedTab: CampDetailTab
}): boolean {
  return (
    input.cache.key === input.expectedCache.key &&
    input.cache.scopeKey === input.expectedCache.scopeKey &&
    input.cache.route === CAMP_DETAIL_TAB_CACHE_ROUTE &&
    String(input.cache.entityId) === String(input.expectedCache.entityId) &&
    input.cache.tab === input.expectedTab &&
    input.cache.filters === input.expectedCache.filters &&
    String(input.cache.page) === String(input.expectedCache.page)
  )
}

function isValidCampDetailTabResponse(input: {
  expectedCache: ApiSliceCacheMetadata
  expectedTab: CampDetailTab
  payload: CampDetailTabDataResponse
}): boolean {
  return (
    doesCampDetailCacheMetadataMatch({
      cache: input.payload.cache,
      expectedCache: input.expectedCache,
      expectedTab: input.expectedTab,
    }) && isCampDetailTabPayload(input.payload.data, input.expectedTab)
  )
}

function buildInitialCampDetailTabResponse(input: {
  cache: ApiSliceCacheMetadata
  initialTab: CampDetailTab
  initialTabData: CampDetailTabPayload
  selectedTab: CampDetailTab
}): CampDetailTabDataResponse | null {
  if (input.selectedTab !== input.initialTab || input.cache.tab !== input.initialTab) {
    return null
  }

  if (!isCampDetailTabPayload(input.initialTabData, input.initialTab)) {
    return null
  }

  return {
    cache: input.cache,
    data: input.initialTabData,
    tab: input.initialTab,
  }
}

async function resolveCampDetailTabErrorMessage(response: Response): Promise<string> {
  let payload: CampDetailTabErrorPayload | null = null

  try {
    payload = (await response.json()) as CampDetailTabErrorPayload
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

  if (response.status === 404 || errorCode === "camp_not_found") {
    return "This camp is unavailable in the active team scope."
  }

  if (response.status === 400) {
    return "This tab request is invalid. Refresh the page and try again."
  }

  return "This tab hit a runtime error while loading. Retry just this tab."
}

async function fetchCampDetailTabData(input: {
  campId: string
  loadMore?: boolean
  notesOffset?: number
  page?: number
  scope: NavigationScope
  selectedHighlight?: TeamSessionHighlightFilter
  signal?: AbortSignal
  tab: CampDetailTab
}): Promise<CampDetailTabDataResponse> {
  const response = await fetch(buildCampDetailTabApiUrl({
    campId: input.campId,
    highlight: input.selectedHighlight,
    loadMore: input.loadMore === true,
    notesOffset: input.notesOffset ?? 0,
    page: input.page ?? 1,
    scope: input.scope,
    tab: input.tab,
  }), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal: input.signal,
  })

  if (!response.ok) {
    throw new Error(await resolveCampDetailTabErrorMessage(response))
  }

  const payload = (await response.json()) as unknown

  if (!isCampDetailTabDataResponse(payload, input.tab)) {
    throw new Error("The loaded tab data did not match the selected tab.")
  }

  return payload
}

function CampTabDataError(input: {
  error: CampDetailTabLoadError
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-center"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">Could not load {input.error.tab}.</p>
        <p className="text-sm text-muted-foreground">{input.error.message}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={input.onRetry}>
        Retry
      </Button>
    </div>
  )
}

function CampGoalNotificationDialog({
  campId,
  defaultOpen,
  scope,
}: {
  campId: string
  defaultOpen: boolean
  scope: NavigationScope
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)
  const [notifyEmail, setNotifyEmail] = React.useState(true)
  const [notifyPush, setNotifyPush] = React.useState(true)
  const [isPending, setIsPending] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")
  const openedPromptCampIdRef = React.useRef<string | null>(
    defaultOpen ? campId : null,
  )

  React.useEffect(() => {
    if (!defaultOpen || openedPromptCampIdRef.current === campId) {
      return
    }

    openedPromptCampIdRef.current = campId
    setNotifyEmail(true)
    setNotifyPush(true)
    setErrorMessage("")
    setIsOpen(true)
  }, [campId, defaultOpen])

  function closeDialog(): void {
    openedPromptCampIdRef.current = null
    setIsOpen(false)
    clearCampGoalNotificationPromptParam()
  }

  async function confirmNotifications(): Promise<void> {
    if (isPending) {
      return
    }

    setIsPending(true)
    setErrorMessage("")

    const formData = new FormData()
    formData.set("campId", campId)
    formData.set("scopeOrgId", scope.activeOrgId)

    if (scope.activeTeamId) {
      formData.set("scopeTeamId", scope.activeTeamId)
    }

    if (notifyEmail) {
      formData.set("notifyEmail", "on")
    }

    if (notifyPush) {
      formData.set("notifyPush", "on")
    }

    try {
      const result = await confirmCampGoalsNotificationAction(formData)

      if (!result.ok) {
        setErrorMessage("Could not notify the crew. Confirm permissions and try again.")
        return
      }

      toast.success("Crew notified.", {
        description: `${result.notifiedCount} crew notification${
          result.notifiedCount === 1 ? "" : "s"
        } queued.`,
      })
      closeDialog()
    } catch {
      setErrorMessage("Could not notify the crew. Confirm permissions and try again.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setIsOpen(true)
          return
        }

        closeDialog()
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        forceOverlayRender
        overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle>Notify crew?</DialogTitle>
          <DialogDescription>
            Camp goals were saved. Send the update to the active crew.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="min-w-0 text-sm font-medium">Email</span>
            <Checkbox checked={notifyEmail} onCheckedChange={setNotifyEmail} />
          </Label>
          <Label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="min-w-0 text-sm font-medium">Push notification</span>
            <Checkbox checked={notifyPush} onCheckedChange={setNotifyPush} />
          </Label>
          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={closeDialog}>
            Skip
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              void confirmNotifications()
            }}
          >
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function isCampKpiTabular(label: string): boolean {
  return label !== "Camp Dates"
}

function CampDetailSummaryCards({ kpis }: { kpis: CampDetailKpi[] }) {
  return (
    <>
      <GradientCard className="overflow-hidden p-0 md:hidden">
        <div className="divide-y divide-border px-6 py-3">
          {kpis.map((kpi) => (
            <div
              key={`mobile-camp-summary-${kpi.label}`}
              className="flex min-h-12 items-center justify-between gap-4"
            >
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p
                className={cn(
                  "text-right text-sm font-semibold",
                  isCampKpiTabular(kpi.label) ? "tabular-nums" : null,
                )}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </GradientCard>

      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <GradientCard key={`desktop-camp-summary-${kpi.label}`}>
            <CardHeader>
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle
                className={cn(
                  "text-xl font-semibold",
                  isCampKpiTabular(kpi.label) ? "tabular-nums" : null,
                )}
              >
                {kpi.value}
              </CardTitle>
            </CardHeader>
          </GradientCard>
        ))}
      </div>
    </>
  )
}

export function CampDetailTabsClient({
  initialTab,
  initialTabData,
  initialNotesOffset,
  initialSessionHighlight,
  initialSessionLoadMore,
  initialSessionPage,
  kpis,
  campName,
  venueId,
  venueName,
  venueLocation,
  canManageSessions,
  canManageGoals,
  scope,
  campId,
  showCampGoalNotificationPrompt,
}: {
  initialTab: CampDetailTab
  initialTabData: CampDetailTabPayload
  initialNotesOffset: number
  initialSessionHighlight?: TeamSessionHighlightFilter
  initialSessionLoadMore?: boolean
  initialSessionPage: number
  kpis: CampDetailKpi[]
  campName: string
  venueId: string
  venueName: string
  venueLocation: string
  canManageSessions: boolean
  canManageGoals: boolean
  scope: NavigationScope
  campId: string
  showCampGoalNotificationPrompt: boolean
}) {
  const identityKey = `${scope.activeOrgId}:${scope.activeTeamId ?? ""}:${campId}`
  const [tabState, setTabState] = React.useState<{
    identityKey: string
    selectedTab: CampDetailTab
  }>(() => ({
    identityKey,
    selectedTab: initialTab,
  }))
  const selectedTab =
    tabState.identityKey === identityKey ? tabState.selectedTab : initialTab
  const cacheScope = React.useMemo(() => resolveCacheScope(scope), [scope])
  const warmInFlightTabsRef = React.useRef<Set<string>>(new Set())
  const [loadingMoreNotes, setLoadingMoreNotes] = React.useState(false)
  const [notesLoadError, setNotesLoadError] = React.useState<string | null>(null)
  const [notesAppendState, setNotesAppendState] =
    React.useState<NotesAppendState | null>(null)
  const notesLoadMoreRequestVersionRef = React.useRef(0)

  function buildCampSessionsHref(input: {
    highlight?: TeamSessionHighlightFilter
    page?: number
    loadMore?: boolean
  }): string {
    return buildCampDetailHref({
      scope,
      campId,
      tab: "sessions",
      highlight: input.highlight,
      page: input.page,
      loadMore: input.loadMore,
    })
  }

  const updateSelectedTab = React.useCallback(
    (tab: CampDetailTab) => {
      setTabState({
        identityKey,
        selectedTab: tab,
      })

      const nextUrl = buildCampDetailHref({
        scope,
        campId,
        tab,
        highlight: tab === "sessions" ? initialSessionHighlight : undefined,
        page: tab === "sessions" ? initialSessionPage : undefined,
        loadMore: tab === "sessions" ? initialSessionLoadMore : undefined,
      })

      window.history.replaceState(null, "", `${nextUrl}${window.location.hash}`)
    },
    [
      campId,
      identityKey,
      initialSessionHighlight,
      initialSessionLoadMore,
      initialSessionPage,
      scope,
    ],
  )

  const selectedTabRequest = React.useMemo(
    () =>
      buildCampDetailTabRequest({
        campId,
        highlight: initialSessionHighlight,
        loadMore: initialSessionLoadMore === true,
        notesOffset: selectedTab === "notes" ? initialNotesOffset : 0,
        page: initialSessionPage,
        scope,
        tab: selectedTab,
      }),
    [
      campId,
      initialNotesOffset,
      initialSessionHighlight,
      initialSessionLoadMore,
      initialSessionPage,
      scope,
      selectedTab,
    ],
  )
  const selectedTabCache = React.useMemo(
    () =>
      buildCampDetailTabCacheFromRequest({
        cacheScope,
        request: selectedTabRequest,
      }),
    [cacheScope, selectedTabRequest],
  )
  const selectedInitialPayload = React.useMemo(
    () =>
      buildInitialCampDetailTabResponse({
        cache: selectedTabCache,
        initialTab,
        initialTabData,
        selectedTab,
      }),
    [initialTab, initialTabData, selectedTab, selectedTabCache],
  )
  const fetchFreshTabData = React.useCallback(
    async ({ signal }: { signal: AbortSignal }) =>
      fetchCampDetailTabData({
        campId: selectedTabRequest.campId,
        loadMore: selectedTabRequest.loadMore,
        notesOffset: selectedTabRequest.notesOffset,
        page: selectedTabRequest.page,
        scope: selectedTabRequest.scope,
        selectedHighlight: selectedTabRequest.highlight ?? undefined,
        signal,
        tab: selectedTabRequest.tab,
      }),
    [selectedTabRequest],
  )
  const validateFreshPayload = React.useCallback(
    (payload: CampDetailTabDataResponse) =>
      isValidCampDetailTabResponse({
        expectedCache: selectedTabCache,
        expectedTab: selectedTab,
        payload,
      }),
    [selectedTab, selectedTabCache],
  )
  const routeData = useStaleRouteData<CampDetailTabDataResponse>({
    cacheKey: selectedTabCache.key,
    scope: cacheScope,
    staleMs: SCOPED_ROUTE_DETAIL_TAB_STALE_MS,
    initialData: selectedInitialPayload,
    enabled: scope.activeTeamId !== null,
    fetchFreshData: fetchFreshTabData,
    validateFreshPayload,
  })

  React.useEffect(() => {
    if (scope.activeTeamId === null) {
      return
    }

    const sessionsRequest = buildCampDetailTabRequest({
      campId,
      loadMore: false,
      notesOffset: 0,
      page: 1,
      scope,
      tab: "sessions",
    })
    const sessionsCache = buildCampDetailTabCacheFromRequest({
      cacheScope,
      request: sessionsRequest,
    })

    if (
      sessionsCache.key === selectedTabCache.key ||
      warmInFlightTabsRef.current.has(sessionsCache.key)
    ) {
      return
    }

    const cachedSessions = readScopedRouteCache<CampDetailTabDataResponse>({
      key: sessionsCache.key,
      scope: cacheScope,
    })

    if (cachedSessions.status === "hit" && !cachedSessions.isStale) {
      return
    }

    const controller = new AbortController()
    warmInFlightTabsRef.current.add(sessionsCache.key)

    void fetchCampDetailTabData({
      campId: sessionsRequest.campId,
      loadMore: sessionsRequest.loadMore,
      notesOffset: sessionsRequest.notesOffset,
      page: sessionsRequest.page,
      scope: sessionsRequest.scope,
      selectedHighlight: sessionsRequest.highlight ?? undefined,
      signal: controller.signal,
      tab: sessionsRequest.tab,
    })
      .then((payload) => {
        if (
          controller.signal.aborted ||
          !isValidCampDetailTabResponse({
            expectedCache: sessionsCache,
            expectedTab: "sessions",
            payload,
          })
        ) {
          return
        }

        writeScopedRouteCache({
          key: sessionsCache.key,
          scope: cacheScope,
          payload,
          staleMs: SCOPED_ROUTE_DETAIL_TAB_STALE_MS,
        })
      })
      .catch(() => {
        // Warm failures should never interrupt the visible tab.
      })
      .finally(() => {
        warmInFlightTabsRef.current.delete(sessionsCache.key)
      })

    return () => {
      controller.abort()
    }
  }, [cacheScope, campId, scope, selectedTabCache.key])

  const retrySelectedTab = routeData.retry

  const selectedRoutePayload =
    routeData.data &&
    isValidCampDetailTabResponse({
      expectedCache: selectedTabCache,
      expectedTab: selectedTab,
      payload: routeData.data,
    })
      ? routeData.data
      : null
  const selectedPayload = selectedRoutePayload ?? selectedInitialPayload
  const selectedTabData = selectedPayload?.data ?? null
  const notesDataFromRoute =
    selectedTab === "notes" && selectedTabData
      ? (selectedTabData as CampDetailNotesTabData)
      : null
  const displayedNotesData =
    notesAppendState?.cacheKey === selectedTabCache.key
      ? notesAppendState.data
      : notesDataFromRoute
  const showInlineError = routeData.status === "error" && routeData.hasData
  const isSelectedTabRevalidating = routeData.isRevalidating && routeData.hasData

  const loadMoreNotes = React.useCallback(async () => {
    if (
      !displayedNotesData ||
      displayedNotesData.nextSessionOffset === null ||
      loadingMoreNotes
    ) {
      return
    }

    const requestVersion = notesLoadMoreRequestVersionRef.current + 1
    notesLoadMoreRequestVersionRef.current = requestVersion
    setLoadingMoreNotes(true)
    setNotesLoadError(null)

    try {
      const nextTabData = await fetchCampDetailTabData({
        campId,
        notesOffset: displayedNotesData.nextSessionOffset,
        scope,
        tab: "notes",
      })

      if (notesLoadMoreRequestVersionRef.current !== requestVersion) {
        return
      }

      setNotesAppendState({
        cacheKey: selectedTabCache.key,
        data: appendCampDetailNotesTabData({
          currentNotes: displayedNotesData,
          nextData: nextTabData.data,
        }),
      })
      setNotesLoadError(null)
    } catch (error) {
      if (notesLoadMoreRequestVersionRef.current !== requestVersion) {
        return
      }

      const message = error instanceof Error ? error.message : "Could not load more notes."
      setNotesLoadError(message)
    } finally {
      if (notesLoadMoreRequestVersionRef.current === requestVersion) {
        setLoadingMoreNotes(false)
      }
    }
  }, [campId, displayedNotesData, loadingMoreNotes, scope, selectedTabCache.key])

  function renderPendingTab(tab: CampDetailTab) {
    if (routeData.status === "error" && !routeData.hasData) {
      return (
        <CampTabDataError
          error={{
            message: routeData.error?.message ?? "Could not load this tab.",
            tab,
          }}
          onRetry={retrySelectedTab}
        />
      )
    }

    return <CampDetailPanelSkeleton selectedTab={tab} />
  }

  function renderSessionsTab() {
    const sessionsData =
      selectedTab === "sessions" && selectedTabData
        ? (selectedTabData as CampDetailSessionsTabData)
        : null

    if (!sessionsData) {
      return renderPendingTab("sessions")
    }

    const sessionReturnPath = buildCampDetailHref({
      scope,
      campId,
      tab: "sessions",
      highlight: sessionsData.selectedHighlight,
      page: sessionsData.currentPage,
    })

    return (
      <TeamSessionsTable
        sessions={sessionsData.sessions}
        campOptions={sessionsData.campOptions}
        canManageSessions={canManageSessions}
        noTeamSelected={false}
        toolbar={
          <TeamSessionsToolbar
            scope={scope}
            selectedVenueId=""
            selectedCampId=""
            selectedHighlight={sessionsData.selectedHighlight ?? ""}
            venueDisabled
            campDisabled
            showVenueFilter={false}
            showCampFilter={false}
            venueOptions={[
              {
                value: "",
                label: `${venueName} — ${venueLocation}`,
                href: buildCampSessionsHref({
                  highlight: sessionsData.selectedHighlight,
                }),
              },
            ]}
            campOptions={[
              {
                value: "",
                label: campName,
                href: buildCampSessionsHref({
                  highlight: sessionsData.selectedHighlight,
                }),
              },
            ]}
            highlightOptions={[
              {
                value: "",
                label: "All",
                href: buildCampSessionsHref({}),
              },
              {
                value: "yes",
                label: "Yes",
                href: buildCampSessionsHref({ highlight: "yes" }),
              },
              {
                value: "no",
                label: "No",
                href: buildCampSessionsHref({ highlight: "no" }),
              },
            ]}
            buildHref={({ highlight }) =>
              buildCampSessionsHref({
                highlight,
              })
            }
            action={
              <CreateSessionDialog
                campOptions={sessionsData.campOptions}
                scope={scope}
                selectedVenueId={venueId}
                selectedCampId={campId}
                selectedHighlight={sessionsData.selectedHighlight}
                currentPage={sessionsData.currentPage}
                returnPath={sessionReturnPath}
                disabled={!canManageSessions || sessionsData.campOptions.length === 0}
                surface="sheet"
              />
            }
          />
        }
        scope={scope}
        selectedVenueId={venueId}
        selectedCampId={campId}
        selectedHighlight={sessionsData.selectedHighlight}
        currentPage={sessionsData.currentPage}
        pageCount={sessionsData.pageCount}
        hasPreviousPage={sessionsData.hasPreviousPage}
        hasNextPage={sessionsData.hasNextPage}
        returnPath={sessionReturnPath}
      />
    )
  }

  function renderGoalsTab() {
    const goalsData =
      selectedTab === "goals" && selectedTabData
        ? (selectedTabData as CampDetailGoalsTabData)
        : null

    if (!goalsData) {
      return renderPendingTab("goals")
    }

    return (
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Camp Goals</h3>
              <p className="text-sm text-muted-foreground">
                Main objectives and priorities for this camp.
              </p>
            </div>
            {canManageGoals ? (
              <CampGoalsEditSurface campId={campId} scope={scope} goals={goalsData.goals} />
            ) : null}
          </div>

          <div className="min-h-48 rounded-xl border bg-muted/20 p-4">
            {goalsData.goals && goalsData.goals.trim().length > 0 ? (
              <p className="whitespace-pre-wrap text-base leading-relaxed">{goalsData.goals}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No goals set for this camp yet.</p>
            )}
          </div>
        </div>
      </section>
    )
  }

  function renderNotesTab() {
    const notesData = displayedNotesData

    if (!notesData) {
      return renderPendingTab("notes")
    }

    const hasMoreNotes = notesData.nextSessionOffset !== null

    return (
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="space-y-4">
          <header className="space-y-1">
            <h3 className="text-base font-semibold">Session Notes</h3>
            <p className="text-sm text-muted-foreground">
              Notes and review points from sessions in this camp.
            </p>
          </header>

          {notesData.notesCards.length === 0 && !hasMoreNotes ? (
            <p className="text-sm text-muted-foreground">
              No session notes recorded for this camp yet.
            </p>
          ) : (
            <div className="space-y-4">
              {notesData.notesCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No session notes found in the loaded sessions.
                </p>
              ) : (
                <ul className="space-y-4">
                  {notesData.notesCards.map((card) => (
                    <li key={card.sessionId} className="rounded-xl border p-4">
                      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">{card.sessionDateLabel}</h4>
                        <p className="text-xs font-medium text-muted-foreground">
                          {card.sessionTypeLabel}
                        </p>
                      </header>

                      <dl className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="text-xs font-medium uppercase text-muted-foreground">
                            Free Notes
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm">
                            {renderNoteValue(card.freeNotes)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase text-muted-foreground">
                            Best
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm">
                            {renderNoteValue(card.best)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase text-muted-foreground">
                            To Work
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm">
                            {renderNoteValue(card.toWork)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase text-muted-foreground">
                            Standard Moves
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm">
                            {renderNoteValue(card.standardMoves)}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs font-medium uppercase text-muted-foreground">
                            Wind Pattern
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm">
                            {renderNoteValue(card.windPattern)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}

              {notesLoadError ? (
                <p role="alert" className="text-sm text-destructive">
                  {notesLoadError}
                </p>
              ) : null}

              {hasMoreNotes ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  disabled={loadingMoreNotes}
                  onClick={() => void loadMoreNotes()}
                >
                  {loadingMoreNotes ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                      Loading more...
                    </>
                  ) : (
                    "Load more notes"
                  )}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </section>
    )
  }

  function renderSelectedTabPanel() {
    const hasLoadedTabData =
      selectedTab === "notes" ? displayedNotesData !== null : selectedTabData !== null
    const content =
      selectedTab === "sessions"
        ? renderSessionsTab()
        : selectedTab === "goals"
          ? renderGoalsTab()
          : renderNotesTab()

    if (!hasLoadedTabData) {
      return content
    }

    return (
      <div className="relative">
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
          {content}
        </div>

        {isSelectedTabRevalidating ? (
          <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border bg-background/90 p-2 text-muted-foreground shadow-sm">
            <Loader2Icon className="size-4 animate-spin" />
            <span className="sr-only">Refreshing {selectedTab}</span>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CampGoalNotificationDialog
        campId={campId}
        defaultOpen={showCampGoalNotificationPrompt}
        scope={scope}
      />
      <CampDetailSummaryCards kpis={kpis} />

      <Tabs
        value={selectedTab}
        onValueChange={(value) => updateSelectedTab(resolveTab(value))}
        className="space-y-4"
      >
        <div className="flex h-11 w-full max-w-full items-center rounded-lg bg-muted p-[3px] text-muted-foreground md:hidden">
          <TabsList className="h-full min-w-0 flex-1 rounded-md bg-transparent p-0 group-data-horizontal/tabs:h-full">
            {CAMP_DETAIL_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="min-w-0 basis-0 px-2 capitalize">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsList className="hidden h-10 md:inline-flex">
          {CAMP_DETAIL_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="min-w-fit capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedTab}>{renderSelectedTabPanel()}</TabsContent>
      </Tabs>
    </div>
  )
}
