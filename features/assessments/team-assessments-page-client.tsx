"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PlusIcon } from "lucide-react"

import { TeamAssessmentRunCreateDialog } from "@/features/assessments/team-assessment-run-create-dialog"
import { TeamAssessmentRunsList } from "@/features/assessments/team-assessment-runs-list"
import { TeamAssessmentTemplateEditorShell } from "@/features/assessments/team-assessment-template-editor-shell"
import {
  TeamAssessmentTemplateEditorSkeleton,
  TeamAssessmentsCreatedTabSkeleton,
  TeamAssessmentsTemplatesTabSkeleton,
} from "@/features/assessments/team-assessments-tab-skeletons"
import type {
  TeamAssessmentsCreatedTabData,
  TeamAssessmentsTemplatesTabData,
} from "@/features/assessments/data"
import {
  buildTeamAssessmentsHref,
  type TeamAssessmentTab,
} from "@/features/assessments/navigation"
import { buildTeamAssessmentsTabDataUrl } from "@/features/assessments/tab-data-route-state.mjs"
import type { NavigationScope } from "@/lib/navigation/types"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type TeamAssessmentsCreatedTabCache = {
  data: TeamAssessmentsCreatedTabData
  loadMore: boolean
  page: number
}

type TeamAssessmentsTabDataState = {
  created?: TeamAssessmentsCreatedTabCache
  templates?: TeamAssessmentsTemplatesTabData
}

type TeamAssessmentsTabDataResponse =
  | {
      data: TeamAssessmentsCreatedTabData
      tab: "created"
    }
  | {
      data: TeamAssessmentsTemplatesTabData
      tab: "templates"
    }

type TeamAssessmentsTabErrorPayload = {
  detail?: unknown
  error?: unknown
}

type TeamAssessmentsTabLoadError = {
  message: string
  tab: TeamAssessmentTab
}

type TeamAssessmentsCreatedTabRequest = {
  loadMore: boolean
  page: number
}

type PendingTemplateEditorNavigation =
  | {
      type: "new"
    }
  | {
      templateId: string
      type: "template"
    }

function normalizeRequestedPage(value: string | null): number {
  if (!value) {
    return 1
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return Math.floor(parsed)
}

function getCreatedTabRequest(search: string): TeamAssessmentsCreatedTabRequest {
  const params = new URLSearchParams(search)

  return {
    loadMore: params.get("loadMore") === "1",
    page: normalizeRequestedPage(params.get("page")),
  }
}

function getEmptyCreatedTabData(
  request: TeamAssessmentsCreatedTabRequest,
): TeamAssessmentsCreatedTabData {
  return {
    venueOptions: [],
    campOptions: [],
    templateOptions: [],
    runs: [],
    pagination: {
      currentPage: request.page,
      pageCount: 1,
      hasPreviousPage: request.page > 1 && !request.loadMore,
      hasNextPage: false,
    },
  }
}

function buildInitialTabDataState(input: {
  createdData?: TeamAssessmentsCreatedTabData
  createdRequest: TeamAssessmentsCreatedTabRequest
  templatesData?: TeamAssessmentsTemplatesTabData
}): TeamAssessmentsTabDataState {
  const state: TeamAssessmentsTabDataState = {}

  if (input.createdData) {
    state.created = {
      data: input.createdData,
      loadMore: input.createdRequest.loadMore,
      page: input.createdRequest.page,
    }
  }

  if (input.templatesData) {
    state.templates = input.templatesData
  }

  return state
}

function isCreatedCacheForRequest(input: {
  cache?: TeamAssessmentsCreatedTabCache
  request: TeamAssessmentsCreatedTabRequest
}): boolean {
  return (
    typeof input.cache !== "undefined" &&
    input.cache.page === input.request.page &&
    input.cache.loadMore === input.request.loadMore
  )
}

function getAffectedAssessmentTabsForStatus(
  status: string | null,
): Set<TeamAssessmentTab> {
  if (status === "template_saved") {
    return new Set(["created", "templates"])
  }

  if (
    status === "run_published" ||
    status === "run_closed" ||
    status === "run_deleted" ||
    status === "answers_saved" ||
    status === "created" ||
    status === "closed" ||
    status === "deleted"
  ) {
    return new Set(["created"])
  }

  return new Set()
}

function invalidateAssessmentTabDataState(input: {
  affectedTabs: Set<TeamAssessmentTab>
  state: TeamAssessmentsTabDataState
}): TeamAssessmentsTabDataState {
  if (input.affectedTabs.size === 0) {
    return input.state
  }

  return {
    created: input.affectedTabs.has("created") ? undefined : input.state.created,
    templates: input.affectedTabs.has("templates") ? undefined : input.state.templates,
  }
}

async function resolveTeamAssessmentsTabErrorMessage(
  response: Response,
): Promise<string> {
  let payload: TeamAssessmentsTabErrorPayload | null = null

  try {
    payload = (await response.json()) as TeamAssessmentsTabErrorPayload
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

  if (response.status === 403 || errorCode === "profile_required") {
    return "Your account profile is still being prepared. Try again shortly."
  }

  if (response.status === 400) {
    return "This tab request is invalid. Refresh the page and try again."
  }

  return "This tab hit a runtime error while loading. Retry just this tab."
}

async function fetchTeamAssessmentsTabData(input: {
  activeOrgId: string
  activeTeamId?: string | null
  loadMore?: boolean
  page?: number
  tab: TeamAssessmentTab
}): Promise<TeamAssessmentsTabDataResponse> {
  const response = await fetch(buildTeamAssessmentsTabDataUrl(input), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(await resolveTeamAssessmentsTabErrorMessage(response))
  }

  const payload = (await response.json()) as TeamAssessmentsTabDataResponse

  if (payload.tab !== input.tab) {
    throw new Error("The loaded tab data did not match the selected tab.")
  }

  return payload
}

function normalizeInternalHref(href: string): string {
  const url = new URL(href, "http://sailog.local")
  return `${url.pathname}${url.search}`
}

function getPendingTemplateEditorNavigation(
  href: string,
): PendingTemplateEditorNavigation | null {
  const url = new URL(href, "http://sailog.local")

  if (url.searchParams.get("new") === "template") {
    return {
      type: "new",
    }
  }

  const templateId = url.searchParams.get("template")

  if (templateId) {
    return {
      templateId,
      type: "template",
    }
  }

  return null
}

function shouldHandleTemplateNavigation(
  event: React.MouseEvent<HTMLAnchorElement>,
): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
  )
}

function TeamAssessmentsTabDataError({
  error,
  onRetry,
}: {
  error: TeamAssessmentsTabLoadError
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-center"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">Could not load {error.tab}.</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

export function TeamAssessmentsPageClient({
  canManageAssessments,
  creatingTemplate,
  createdData,
  noTeamSelected,
  scope,
  selectedTab,
  selectedTemplateId,
  templatesData,
}: {
  canManageAssessments: boolean
  creatingTemplate: boolean
  createdData?: TeamAssessmentsCreatedTabData
  noTeamSelected: boolean
  scope: NavigationScope
  selectedTab: TeamAssessmentTab
  selectedTemplateId?: string
  templatesData?: TeamAssessmentsTemplatesTabData
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentSearch = searchParams.toString()
  const status = searchParams.get("status")
  const createdRequest = React.useMemo(
    () => getCreatedTabRequest(currentSearch),
    [currentSearch],
  )
  const [activeTab, setActiveTab] = React.useState<TeamAssessmentTab>(selectedTab)
  const [tabData, setTabData] = React.useState<TeamAssessmentsTabDataState>(() =>
    buildInitialTabDataState({
      createdData,
      createdRequest,
      templatesData,
    }),
  )
  const [loadError, setLoadError] =
    React.useState<TeamAssessmentsTabLoadError | null>(null)
  const [pendingTemplateNavigation, setPendingTemplateNavigation] =
    React.useState<PendingTemplateEditorNavigation | null>(null)
  const [isTemplateListNavigationPending, setIsTemplateListNavigationPending] =
    React.useState(false)
  const [isTemplateNavigationPending, startTemplateNavigationTransition] =
    React.useTransition()
  const [isTemplateListTransitionPending, startTemplateListTransition] =
    React.useTransition()
  const scopeKey = `${scope.activeOrgId}:${scope.activeTeamId ?? ""}`
  const scopeKeyRef = React.useRef(scopeKey)
  const selectedTabRef = React.useRef(selectedTab)
  const inFlightTabsRef = React.useRef<Set<string>>(new Set())
  const requestVersionRef = React.useRef(0)
  const latestTabRequestVersionRef = React.useRef<Record<TeamAssessmentTab, number>>({
    created: 0,
    templates: 0,
  })
  const currentHref = normalizeInternalHref(
    currentSearch.length > 0
      ? `${pathname}?${currentSearch}`
      : pathname,
  )
  const templatesHref = buildTeamAssessmentsHref({
    scope,
    tab: "templates",
  })
  const createdHref = buildTeamAssessmentsHref({
    scope,
    tab: "created",
  })
  const newTemplateHref = buildTeamAssessmentsHref({
    scope,
    tab: "templates",
    newTemplate: true,
  })
  const activeCreatedCache = tabData.created
  const activeCreatedData =
    activeTab === "created" &&
    isCreatedCacheForRequest({
      cache: activeCreatedCache,
      request: createdRequest,
    })
      ? activeCreatedCache?.data
      : undefined
  const activeTemplatesData =
    activeTab === "templates" ? tabData.templates : undefined
  const isActiveTabLoaded =
    activeTab === "created" ? Boolean(activeCreatedData) : Boolean(activeTemplatesData)
  const isTemplateEditorNavigationPending =
    activeTab === "templates" &&
    (isTemplateNavigationPending || pendingTemplateNavigation !== null)
  const shouldShowTemplateListSkeleton =
    activeTab === "templates" &&
    (isTemplateListTransitionPending || isTemplateListNavigationPending)
  const createRunDisabled =
    activeTab !== "created" ||
    !activeCreatedData ||
    noTeamSelected ||
    !canManageAssessments ||
    activeCreatedData.templateOptions.length === 0 ||
    activeCreatedData.venueOptions.length === 0 ||
    activeCreatedData.campOptions.length === 0

  const loadTabData = React.useCallback(
    async (tab: TeamAssessmentTab, options?: { force?: boolean }) => {
      const request = getCreatedTabRequest(window.location.search)
      const requestKey =
        tab === "created"
          ? `${tab}:${request.page}:${request.loadMore ? "load-more" : "page"}`
          : tab

      if (!options?.force) {
        if (
          tab === "created" &&
          isCreatedCacheForRequest({
            cache: tabData.created,
            request,
          })
        ) {
          return
        }

        if (tab === "templates" && tabData.templates) {
          return
        }
      }

      if (noTeamSelected || !scope.activeTeamId) {
        setTabData((currentState) => {
          if (tab === "created") {
            return {
              ...currentState,
              created: {
                data: getEmptyCreatedTabData(request),
                loadMore: request.loadMore,
                page: request.page,
              },
            }
          }

          return {
            ...currentState,
            templates: {
              templates: [],
            },
          }
        })
        return
      }

      if (inFlightTabsRef.current.has(requestKey)) {
        return
      }

      const requestVersion = requestVersionRef.current + 1
      requestVersionRef.current = requestVersion
      latestTabRequestVersionRef.current[tab] = requestVersion
      inFlightTabsRef.current.add(requestKey)
      setLoadError((currentError) => (currentError?.tab === tab ? null : currentError))

      try {
        const payload = await fetchTeamAssessmentsTabData({
          activeOrgId: scope.activeOrgId,
          activeTeamId: scope.activeTeamId,
          loadMore: request.loadMore,
          page: request.page,
          tab,
        })

        if (latestTabRequestVersionRef.current[tab] !== requestVersion) {
          return
        }

        setTabData((currentState) => {
          if (payload.tab === "created") {
            return {
              ...currentState,
              created: {
                data: payload.data,
                loadMore: request.loadMore,
                page: request.page,
              },
            }
          }

          return {
            ...currentState,
            templates: payload.data,
          }
        })
      } catch (error) {
        if (latestTabRequestVersionRef.current[tab] !== requestVersion) {
          return
        }

        const message = error instanceof Error ? error.message : "Could not load this tab."
        setLoadError({ message, tab })
      } finally {
        inFlightTabsRef.current.delete(requestKey)
      }
    },
    [
      noTeamSelected,
      scope.activeOrgId,
      scope.activeTeamId,
      tabData.created,
      tabData.templates,
    ],
  )

  React.useEffect(() => {
    const didScopeChange = scopeKeyRef.current !== scopeKey
    const didSelectedTabChange = selectedTabRef.current !== selectedTab
    scopeKeyRef.current = scopeKey
    selectedTabRef.current = selectedTab

    requestVersionRef.current += 1
    latestTabRequestVersionRef.current = {
      created: 0,
      templates: 0,
    }
    inFlightTabsRef.current.clear()

    if (didScopeChange || didSelectedTabChange) {
      setActiveTab(selectedTab)
    }

    setTabData((currentState) => {
      const affectedTabs = didScopeChange
        ? new Set<TeamAssessmentTab>()
        : getAffectedAssessmentTabsForStatus(status)
      const baseState = didScopeChange
        ? {}
        : invalidateAssessmentTabDataState({
            affectedTabs,
            state: currentState,
          })

      return {
        ...baseState,
        ...(createdData
          ? {
              created: {
                data: createdData,
                loadMore: createdRequest.loadMore,
                page: createdRequest.page,
              },
            }
          : null),
        ...(templatesData ? { templates: templatesData } : null),
      }
    })
    setLoadError((currentError) =>
      currentError?.tab === selectedTab ? null : currentError,
    )
  }, [
    createdData,
    createdRequest.loadMore,
    createdRequest.page,
    scopeKey,
    selectedTab,
    status,
    templatesData,
  ])

  React.useEffect(() => {
    void loadTabData(activeTab)
  }, [activeTab, loadTabData])

  const retryActiveTab = React.useCallback(() => {
    void loadTabData(activeTab, { force: true })
  }, [activeTab, loadTabData])

  React.useEffect(() => {
    if (selectedTab === "templates" && !creatingTemplate && !selectedTemplateId) {
      setIsTemplateListNavigationPending(false)
    }
  }, [creatingTemplate, selectedTab, selectedTemplateId])

  React.useEffect(() => {
    setPendingTemplateNavigation((currentValue) => {
      if (!currentValue) {
        return currentValue
      }

      if (selectedTab !== "templates") {
        return null
      }

      if (currentValue.type === "new" && creatingTemplate) {
        return null
      }

      if (
        currentValue.type === "template" &&
        selectedTemplateId === currentValue.templateId
      ) {
        return null
      }

      return currentValue
    })
  }, [creatingTemplate, selectedTab, selectedTemplateId])

  function switchTab(nextTabValue: string): void {
    const nextTab: TeamAssessmentTab =
      nextTabValue === "templates" ? "templates" : "created"

    if (nextTab === activeTab) {
      return
    }

    setActiveTab(nextTab)
    window.history.replaceState(
      null,
      "",
      `${nextTab === "templates" ? templatesHref : createdHref}${window.location.hash}`,
    )
    void loadTabData(nextTab)
  }

  function openTemplateEditor(href: string): void {
    setIsTemplateListNavigationPending(false)
    setPendingTemplateNavigation(getPendingTemplateEditorNavigation(href))
    startTemplateNavigationTransition(() => {
      router.push(href)
    })
  }

  function closeTemplateEditor(href: string): void {
    setPendingTemplateNavigation(null)
    setIsTemplateListNavigationPending(true)
    startTemplateListTransition(() => {
      router.push(href)
    })
  }

  function handleTemplateEditorLinkClick(
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ): void {
    if (!shouldHandleTemplateNavigation(event)) {
      return
    }

    event.preventDefault()
    openTemplateEditor(href)
  }

  return (
    <section
      aria-busy={
        isTemplateEditorNavigationPending ||
        shouldShowTemplateListSkeleton ||
        !isActiveTabLoaded
      }
      className="space-y-4"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:w-auto">
          <Tabs
            value={activeTab}
            onValueChange={switchTab}
            className="w-full gap-0 md:w-auto"
          >
            <TabsList className="grid h-10 w-full grid-cols-2 md:inline-flex md:w-fit">
              <TabsTrigger value="created" className="w-full">
                Created
              </TabsTrigger>
              <TabsTrigger value="templates" className="w-full">
                Templates
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex justify-end">
          {activeTab === "created" ? (
            <TeamAssessmentRunCreateDialog
              campOptions={activeCreatedData?.campOptions ?? []}
              disabled={createRunDisabled}
              returnPath={currentHref}
              scope={scope}
              templateOptions={activeCreatedData?.templateOptions ?? []}
              venueOptions={activeCreatedData?.venueOptions ?? []}
            />
          ) : canManageAssessments ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="hidden md:inline-flex"
                nativeButton={false}
                render={
                  <Link
                    href={newTemplateHref}
                    onClick={(event) =>
                      handleTemplateEditorLinkClick(event, newTemplateHref)
                    }
                  />
                }
              >
                <PlusIcon className="size-4" />
                New
              </Button>
              <Button
                variant="default"
                size="icon"
                aria-label="New assessment template"
                className="mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
                nativeButton={false}
                render={
                  <Link
                    href={newTemplateHref}
                    onClick={(event) =>
                      handleTemplateEditorLinkClick(event, newTemplateHref)
                    }
                  />
                }
              >
                <PlusIcon className="size-6" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {activeTab === "created" && activeCreatedData?.templateOptions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Create a template first to add an assessment.
        </p>
      ) : null}

      {activeTab === "created" ? (
        activeCreatedData ? (
          <TeamAssessmentRunsList
            canManageAssessments={canManageAssessments}
            data={activeCreatedData}
            returnPath={currentHref}
            scope={scope}
          />
        ) : loadError?.tab === "created" ? (
          <TeamAssessmentsTabDataError error={loadError} onRetry={retryActiveTab} />
        ) : (
          <TeamAssessmentsCreatedTabSkeleton />
        )
      ) : activeTemplatesData ? (
        shouldShowTemplateListSkeleton ? (
          <TeamAssessmentsTemplatesTabSkeleton canManageAssessments={canManageAssessments} />
        ) : isTemplateEditorNavigationPending ? (
          <TeamAssessmentTemplateEditorSkeleton />
        ) : (
          <TeamAssessmentTemplateEditorShell
            cancelHref={templatesHref}
            canManageAssessments={canManageAssessments}
            creatingTemplate={creatingTemplate}
            onCancel={closeTemplateEditor}
            onTemplateOpen={openTemplateEditor}
            scope={scope}
            selectedTemplateId={selectedTemplateId}
            templates={activeTemplatesData.templates}
          />
        )
      ) : loadError?.tab === "templates" ? (
        <TeamAssessmentsTabDataError error={loadError} onRetry={retryActiveTab} />
      ) : (
        <TeamAssessmentsTemplatesTabSkeleton canManageAssessments={canManageAssessments} />
      )}
    </section>
  )
}
