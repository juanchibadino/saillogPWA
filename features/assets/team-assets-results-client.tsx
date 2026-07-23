"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  DownloadIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MoreVerticalIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  buildAssetDownloadUrl,
  SessionAssetCard,
} from "@/features/assets/asset-browser-grid"
import { buildTeamAssetsListApiUrl } from "@/features/assets/team-assets-list-cache"
import { buildTeamAssetsHref } from "@/features/assets/list-route-state.mjs"
import { buildCampDetailHref } from "@/features/camps/navigation"
import { buildSessionDetailHref } from "@/features/sessions/navigation"
import { deleteSessionAssetAction } from "@/features/sessions/detail-actions"
import { SessionGpsFileCard } from "@/features/sessions/detail/gps-files-panel"
import type {
  TeamAssetListItem,
  TeamAssetsChromeData,
  TeamAssetsPageData,
  TeamAssetsResultsData,
  TeamAssetTab,
} from "@/features/assets/data"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { NavigationScope } from "@/lib/navigation/types"

type TeamAssetSessionGroup = {
  assets: TeamAssetListItem[]
  campId: string
  campName: string
  sessionDate: string
  sessionId: string
  sessionType: TeamAssetListItem["sessionType"]
  venueId: string
  venueName: string
}

type TeamAssetVenueGroup = {
  sessions: TeamAssetSessionGroup[]
  venueId: string
  venueName: string
}

type TeamAssetsListResponse = {
  data: TeamAssetsPageData
}

type TeamAssetGpsListItem = TeamAssetListItem & {
  gpsArtifacts: NonNullable<TeamAssetListItem["gpsArtifacts"]>
  vakaros: Exclude<TeamAssetListItem["vakaros"], undefined>
}

function isTeamAssetGpsListItem(asset: TeamAssetListItem): asset is TeamAssetGpsListItem {
  return asset.asset_type === "gps_file" && Boolean(asset.gpsArtifacts) && "vakaros" in asset
}

function formatSessionTypeLabel(value: TeamAssetListItem["sessionType"]): string {
  return value === "regatta" ? "Regatta" : "Training"
}

function formatSessionDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function getEmptyMessage(input: {
  hasActiveFilters: boolean
  tab: TeamAssetTab
}): string {
  if (input.hasActiveFilters) {
    return "No assets match these filters."
  }

  if (input.tab === "images") {
    return "No images uploaded for this team yet."
  }

  return input.tab === "gps-files"
    ? "No Vakaros uploaded for this team yet."
    : "No files uploaded for this team yet."
}

function compareSessionGroupsNewestFirst(
  left: TeamAssetSessionGroup,
  right: TeamAssetSessionGroup,
): number {
  const dateOrder = right.sessionDate.localeCompare(left.sessionDate)

  if (dateOrder !== 0) {
    return dateOrder
  }

  return 0
}

function compareAssetsNewestFirst(
  left: TeamAssetListItem,
  right: TeamAssetListItem,
): number {
  const createdAtOrder = right.created_at.localeCompare(left.created_at)

  if (createdAtOrder !== 0) {
    return createdAtOrder
  }

  return left.id.localeCompare(right.id)
}

function buildGroups(assets: TeamAssetListItem[]): TeamAssetVenueGroup[] {
  const sessionGroups = new Map<string, TeamAssetSessionGroup>()

  for (const asset of assets) {
    let sessionGroup = sessionGroups.get(asset.sessionId)

    if (!sessionGroup) {
      sessionGroup = {
        assets: [],
        campId: asset.campId,
        campName: asset.campName,
        sessionDate: asset.sessionDate,
        sessionId: asset.sessionId,
        sessionType: asset.sessionType,
        venueId: asset.venueId,
        venueName: asset.venueName,
      }
      sessionGroups.set(asset.sessionId, sessionGroup)
    }

    sessionGroup.assets.push(asset)
  }

  const orderedSessionGroups = Array.from(sessionGroups.values()).sort(
    compareSessionGroupsNewestFirst,
  )
  const venueGroups: TeamAssetVenueGroup[] = []

  for (const session of orderedSessionGroups) {
    session.assets.sort(compareAssetsNewestFirst)

    const lastVenueGroup = venueGroups[venueGroups.length - 1]

    if (lastVenueGroup?.venueId === session.venueId) {
      lastVenueGroup.sessions.push(session)
    } else {
      venueGroups.push({
        sessions: [session],
        venueId: session.venueId,
        venueName: session.venueName,
      })
    }
  }

  return venueGroups
}

function buildAssetCampHref(input: {
  campId: string
  scope: NavigationScope
}): string {
  return buildCampDetailHref({
    campId: input.campId,
    scope: input.scope,
    tab: "sessions",
  })
}

function buildAssetSessionHref(input: {
  scope: NavigationScope
  sessionId: string
  tab: TeamAssetTab
}): string {
  return buildSessionDetailHref({
    scope: input.scope,
    sessionId: input.sessionId,
    tab: input.tab === "images" ? "images" : "analytics",
  })
}

function uniqueAssets(
  currentAssets: TeamAssetListItem[],
  nextAssets: TeamAssetListItem[],
): TeamAssetListItem[] {
  const seenIds = new Set(currentAssets.map((asset) => asset.id))
  const uniqueNextAssets = nextAssets.filter((asset) => {
    if (seenIds.has(asset.id)) {
      return false
    }

    seenIds.add(asset.id)
    return true
  })

  return [...currentAssets, ...uniqueNextAssets]
}

function pickResultsData(data: TeamAssetsPageData): TeamAssetsResultsData {
  return {
    assetLimit: data.assetLimit,
    assetTotalCount: data.assetTotalCount,
    assets: data.assets,
    currentPage: data.currentPage,
    hasNextPage: data.hasNextPage,
    pageCount: data.pageCount,
  }
}

function combinePageData(input: {
  chromeData: TeamAssetsChromeData
  resultsData: TeamAssetsResultsData
}): TeamAssetsPageData {
  return {
    ...input.chromeData,
    ...input.resultsData,
  }
}

function TeamAssetActions(input: {
  asset: TeamAssetListItem
  canManageAssets: boolean
  onAssetDeleted: (assetId: string) => void
  onDeletingChange: (isDeleting: boolean) => void
  scope: NavigationScope
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const deleteLabel = input.asset.asset_type === "photo" ? "Delete image" : "Delete file"
  const downloadUrl = buildAssetDownloadUrl(input.asset.contentUrl)

  async function handleDeleteAsset(): Promise<void> {
    setIsDeleting(true)
    input.onDeletingChange(true)

    try {
      const formData = new FormData()
      formData.set("sessionId", input.asset.sessionId)
      formData.set("assetId", input.asset.id)
      formData.set("scopeOrgId", input.scope.activeOrgId)
      if (input.scope.activeTeamId) {
        formData.set("scopeTeamId", input.scope.activeTeamId)
      }

      const result = await deleteSessionAssetAction(formData)

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(input.asset.asset_type === "photo" ? "Image deleted." : "File deleted.")
      setDeleteDialogOpen(false)
      input.onAssetDeleted(input.asset.id)
    } catch {
      toast.error("Could not delete this file. Confirm storage is available and try again.")
    } finally {
      setIsDeleting(false)
      input.onDeletingChange(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1.5 right-1.5 z-10 bg-background/90 shadow-sm hover:bg-background sm:top-2 sm:right-2"
            />
          }
        >
          <MoreVerticalIcon className="size-4" />
          <span className="sr-only">Asset actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          <DropdownMenuLinkItem
            href={input.asset.contentUrl}
            target="_blank"
            rel="noreferrer"
            className="gap-2"
          >
            <ExternalLinkIcon className="size-4" />
            Open
          </DropdownMenuLinkItem>
          <DropdownMenuLinkItem
            href={downloadUrl}
            download={input.asset.file_name}
            className="gap-2"
          >
            <DownloadIcon className="size-4" />
            Download
          </DropdownMenuLinkItem>

          {input.canManageAssets ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={isDeleting}
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2Icon className="size-4" />
              {deleteLabel}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        modal
        open={deleteDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isDeleting) {
            setDeleteDialogOpen(nextOpen)
          }
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          forceOverlayRender
          overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
        >
          <DialogHeader>
            <DialogTitle>{deleteLabel}</DialogTitle>
            <DialogDescription>
              This removes the asset from its session and deletes the stored file.
            </DialogDescription>
          </DialogHeader>

          <p className="truncate text-sm font-medium">{input.asset.file_name}</p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                void handleDeleteAsset()
              }}
            >
              {isDeleting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <Trash2Icon className="size-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TeamAssetCard(input: {
  asset: TeamAssetListItem
  canManageAssets: boolean
  onAssetDeleted: (assetId: string) => void
  scope: NavigationScope
}) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  if (isTeamAssetGpsListItem(input.asset)) {
    return (
      <SessionGpsFileCard
        gpsFile={input.asset}
        canManageSession={input.canManageAssets}
        onGpsFileDeleted={input.onAssetDeleted}
        scope={input.scope}
        sessionId={input.asset.sessionId}
      />
    )
  }

  return (
    <SessionAssetCard
      asset={input.asset}
      busyLabel="Deleting file"
      isBusy={isDeleting}
      overlayActions={
        <TeamAssetActions
          asset={input.asset}
          canManageAssets={input.canManageAssets}
          onAssetDeleted={input.onAssetDeleted}
          onDeletingChange={setIsDeleting}
          scope={input.scope}
        />
      }
    />
  )
}

function TeamAssetGrid(input: {
  assets: TeamAssetListItem[]
  canManageAssets: boolean
  emptyMessage: string
  onAssetDeleted: (assetId: string) => void
  scope: NavigationScope
}) {
  if (input.assets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
        {input.emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {input.assets.map((asset) => (
        <TeamAssetCard
          key={asset.id}
          asset={asset}
          canManageAssets={input.canManageAssets}
          onAssetDeleted={input.onAssetDeleted}
          scope={input.scope}
        />
      ))}
    </div>
  )
}

function TeamAssetsGroups(input: {
  data: TeamAssetsPageData
  onAssetDeleted: (assetId: string) => void
  scope: NavigationScope
}) {
  const groups = buildGroups(input.data.assets)

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
        {getEmptyMessage({
          hasActiveFilters: input.data.hasActiveFilters,
          tab: input.data.tab,
        })}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {groups.map((venueGroup) => (
        <section
          key={`${venueGroup.venueId}:${venueGroup.sessions[0]?.sessionId ?? "empty"}`}
          className="space-y-4"
        >
          <header className="border-b pb-3">
            <h3 className="text-base font-semibold">{venueGroup.venueName}</h3>
          </header>

          <div className="space-y-6">
            {venueGroup.sessions.map((sessionGroup) => (
              <section key={sessionGroup.sessionId} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link
                    href={buildAssetSessionHref({
                      scope: input.scope,
                      sessionId: sessionGroup.sessionId,
                      tab: input.data.tab,
                    })}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {formatSessionDateLabel(sessionGroup.sessionDate)}
                  </Link>
                  <span className="text-muted-foreground">.</span>
                  <span className="text-muted-foreground">
                    {formatSessionTypeLabel(sessionGroup.sessionType)}
                  </span>
                  <span className="text-muted-foreground">.</span>
                  <Link
                    href={buildAssetCampHref({
                      campId: sessionGroup.campId,
                      scope: input.scope,
                    })}
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {sessionGroup.campName}
                  </Link>
                </div>

                <TeamAssetGrid
                  assets={sessionGroup.assets}
                  canManageAssets={input.data.canManageAssets}
                  emptyMessage={getEmptyMessage({
                    hasActiveFilters: input.data.hasActiveFilters,
                    tab: input.data.tab,
                  })}
                  onAssetDeleted={input.onAssetDeleted}
                  scope={input.scope}
                />
              </section>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function TeamAssetsResultsClient(input: {
  chromeData: TeamAssetsChromeData
  initialResults: TeamAssetsResultsData
  scope: NavigationScope
}) {
  const [resultsData, setResultsData] = React.useState(input.initialResults)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)
  const data = combinePageData({
    chromeData: input.chromeData,
    resultsData,
  })

  React.useEffect(() => {
    setResultsData(input.initialResults)
    setIsLoadingMore(false)
  }, [input.initialResults])

  function handleAssetDeleted(assetId: string): void {
    setResultsData((currentData) => {
      const assetWasLoaded = currentData.assets.some((asset) => asset.id === assetId)

      if (!assetWasLoaded) {
        return currentData
      }

      const nextAssetTotalCount = Math.max(0, currentData.assetTotalCount - 1)
      const nextPageCount = Math.max(
        1,
        Math.ceil(nextAssetTotalCount / currentData.assetLimit),
      )
      const nextCurrentPage = Math.min(currentData.currentPage, nextPageCount)

      return {
        ...currentData,
        assetTotalCount: nextAssetTotalCount,
        assets: currentData.assets.filter((asset) => asset.id !== assetId),
        currentPage: nextCurrentPage,
        hasNextPage: nextCurrentPage < nextPageCount,
        pageCount: nextPageCount,
      }
    })
  }

  async function loadMoreAssets(): Promise<void> {
    if (isLoadingMore || !data.hasNextPage) {
      return
    }

    const nextPage = data.currentPage + 1
    setIsLoadingMore(true)

    try {
      const response = await fetch(
        buildTeamAssetsListApiUrl({
          filters: data.selectedFilters,
          page: nextPage,
          scope: input.scope,
          tab: data.tab,
        }),
        {
          cache: "no-store",
        },
      )

      if (!response.ok) {
        throw new Error("Could not load more assets.")
      }

      const payload = (await response.json()) as TeamAssetsListResponse
      const nextResultsData = pickResultsData(payload.data)
      setResultsData((currentData) => ({
        ...nextResultsData,
        assets: uniqueAssets(currentData.assets, nextResultsData.assets),
      }))
      window.history.replaceState(
        null,
        "",
        buildTeamAssetsHref({
          scope: input.scope,
          tab: data.tab,
          venueId: data.selectedFilters.venueId,
          year: data.selectedFilters.year,
          campId: data.selectedFilters.campId,
          sessionId: data.selectedFilters.sessionId,
          page: nextResultsData.currentPage,
          loadMore: true,
        }),
      )
    } catch {
      toast.error("Could not load more assets. Try again.", {
        id: `team-assets-load-more:${input.scope.activeOrgId}:${input.scope.activeTeamId ?? "none"}:${data.tab}:${nextPage}`,
      })
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <div className="space-y-4">
      <TeamAssetsGroups
        data={data}
        onAssetDeleted={handleAssetDeleted}
        scope={input.scope}
      />

      {data.assetTotalCount > data.assetLimit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <span>
            Showing {data.assets.length} of {data.assetTotalCount}.
          </span>
          {data.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoadingMore}
              onClick={() => {
                void loadMoreAssets()
              }}
            >
              {isLoadingMore ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <ChevronDownIcon className="size-4" />
              )}
              {isLoadingMore ? "Loading more..." : "Load more"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function TeamAssetsResultsRetry({
  message = "Could not load asset results.",
}: {
  message?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()

  return (
    <section
      role="alert"
      aria-live="polite"
      className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Asset results unavailable</h2>
          <p className="text-sm text-amber-800">{message}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          className="border-amber-300 bg-background text-foreground"
          onClick={() => {
            startTransition(() => {
              router.refresh()
            })
          }}
        >
          {isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RotateCcwIcon className="size-4" />
          )}
          {isPending ? "Retrying..." : "Retry results"}
        </Button>
      </div>
    </section>
  )
}
