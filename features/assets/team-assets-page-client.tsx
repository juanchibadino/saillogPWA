"use client"

import * as React from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FilterIcon,
  Loader2Icon,
  MoreVerticalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
import type {
  TeamAssetCampFilterOption,
  TeamAssetListItem,
  TeamAssetsPageData,
  TeamAssetSessionFilterOption,
  TeamAssetsRequestedFilters,
  TeamAssetSelectedFilters,
  TeamAssetTab,
  TeamAssetVenueFilterOption,
  TeamAssetYearFilterOption,
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
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type FilterOption = {
  href: string
  label: string
  value: string
}

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

function normalizeInternalHref(href: string): string {
  const url = new URL(href, "http://sailog.local")

  return `${url.pathname}${url.search}`
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

  return input.tab === "images"
    ? "No images uploaded for this team yet."
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

function buildHref(input: {
  filters: TeamAssetsRequestedFilters
  page?: number
  scope: NavigationScope
  tab: TeamAssetTab
  loadMore?: boolean
}): string {
  return buildTeamAssetsHref({
    scope: input.scope,
    tab: input.tab,
    venueId: input.filters.venueId,
    year: input.filters.year,
    campId: input.filters.campId,
    sessionId: input.filters.sessionId,
    page: input.page,
    loadMore: input.loadMore,
  })
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
    tab: input.tab === "files" ? "analytics" : "images",
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

function FilterDropdown(input: {
  disabled?: boolean
  isNavigating: boolean
  label: string
  onNavigate: (href: string) => void
  options: FilterOption[]
  selectedValue: string
}) {
  const hasActiveFilter = input.selectedValue.length > 0
  const clearOption = input.options.find((option) => option.value.length === 0)
  const selectedOption = input.options.find((option) => option.value === input.selectedValue)
  const isDisabled = input.disabled || input.isNavigating

  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={isDisabled}
              className={cn(
                hasActiveFilter && "rounded-r-none",
                hasActiveFilter &&
                  "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30",
              )}
            />
          }
        >
          <FilterIcon className="size-4" />
          <span>{selectedOption?.label ?? input.label}</span>
          <ChevronDownIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {input.options.map((option) => {
            const isActive = option.value === input.selectedValue

            return (
              <DropdownMenuItem
                key={option.value}
                disabled={input.isNavigating}
                onClick={() => {
                  if (!isActive) {
                    input.onNavigate(option.href)
                  }
                }}
                className="gap-2"
              >
                <span className="flex size-4 items-center justify-center">
                  {isActive ? <CheckIcon className="size-4" /> : null}
                </span>
                <span className="flex-1">{option.label}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {hasActiveFilter && clearOption ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={input.isNavigating}
          aria-label={`Clear ${input.label} filter`}
          className="rounded-l-none border-l-0 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => input.onNavigate(clearOption.href)}
        >
          <XIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}

function buildVenueOptions(input: {
  data: TeamAssetsPageData
  scope: NavigationScope
}): FilterOption[] {
  return [
    {
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          year: input.data.selectedFilters.year,
        },
      }),
      label: "Venue",
      value: "",
    },
    ...input.data.filterOptions.venues.map((option: TeamAssetVenueFilterOption) => ({
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: option.venueId,
          year: input.data.selectedFilters.year,
        },
      }),
      label: option.venueName,
      value: option.venueId,
    })),
  ]
}

function buildYearOptions(input: {
  data: TeamAssetsPageData
  scope: NavigationScope
}): FilterOption[] {
  return [
    {
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: input.data.selectedFilters.venueId,
        },
      }),
      label: "Year",
      value: "",
    },
    ...input.data.filterOptions.years.map((option: TeamAssetYearFilterOption) => ({
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: input.data.selectedFilters.venueId,
          year: option.year,
        },
      }),
      label: option.label,
      value: String(option.year),
    })),
  ]
}

function buildCampOptions(input: {
  data: TeamAssetsPageData
  scope: NavigationScope
}): FilterOption[] {
  return [
    {
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: input.data.selectedFilters.venueId,
          year: input.data.selectedFilters.year,
        },
      }),
      label: "Camp",
      value: "",
    },
    ...input.data.filterOptions.camps.map((option: TeamAssetCampFilterOption) => ({
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: input.data.selectedFilters.venueId,
          year: input.data.selectedFilters.year,
          campId: option.campId,
        },
      }),
      label: option.label,
      value: option.campId,
    })),
  ]
}

function buildSessionOptions(input: {
  data: TeamAssetsPageData
  scope: NavigationScope
}): FilterOption[] {
  return [
    {
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: input.data.selectedFilters.venueId,
          year: input.data.selectedFilters.year,
          campId: input.data.selectedFilters.campId,
        },
      }),
      label: "Session",
      value: "",
    },
    ...input.data.filterOptions.sessions.map((option: TeamAssetSessionFilterOption) => ({
      href: buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: {
          venueId: input.data.selectedFilters.venueId,
          year: input.data.selectedFilters.year,
          campId: input.data.selectedFilters.campId,
          sessionId: option.sessionId,
        },
      }),
      label: option.label,
      value: option.sessionId,
    })),
  ]
}

function TeamAssetTabs(input: {
  isNavigating: boolean
  onTabChange: (tab: TeamAssetTab) => void
  tab: TeamAssetTab
}) {
  return (
    <Tabs
      value={input.tab}
      onValueChange={(value) => input.onTabChange(value === "files" ? "files" : "images")}
      className="w-full min-w-0 md:w-auto"
    >
      <div className="flex h-11 w-full max-w-full items-center rounded-lg bg-muted p-[3px] text-muted-foreground md:hidden">
        <TabsList className="h-full min-w-0 flex-1 rounded-md bg-transparent p-0 group-data-horizontal/tabs:h-full">
          <TabsTrigger value="images" disabled={input.isNavigating} className="min-w-0 basis-0 px-2">
            Images
          </TabsTrigger>
          <TabsTrigger value="files" disabled={input.isNavigating} className="min-w-0 basis-0 px-2">
            Files
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsList className="hidden h-10 w-56 md:inline-flex">
        <TabsTrigger value="images" disabled={input.isNavigating} className="min-w-0 basis-0">
          Images
        </TabsTrigger>
        <TabsTrigger value="files" disabled={input.isNavigating} className="min-w-0 basis-0">
          Files
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

function TeamAssetsToolbar(input: {
  data: TeamAssetsPageData
  isNavigating: boolean
  onTabChange: (tab: TeamAssetTab) => void
  onNavigate: (href: string) => void
  scope: NavigationScope
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [draftFilters, setDraftFilters] = React.useState<TeamAssetSelectedFilters>(
    input.data.selectedFilters,
  )
  const venueOptions = buildVenueOptions(input)
  const yearOptions = buildYearOptions(input)
  const campOptions = buildCampOptions(input)
  const sessionOptions = buildSessionOptions(input)
  const selectedYearValue =
    typeof input.data.selectedFilters.year === "number"
      ? String(input.data.selectedFilters.year)
      : ""

  function navigateWithDraft(): void {
    input.onNavigate(
      buildHref({
        scope: input.scope,
        tab: input.data.tab,
        filters: draftFilters,
      }),
    )
    setDrawerOpen(false)
  }

  function clearFilters(): void {
    const href = buildHref({
      scope: input.scope,
      tab: input.data.tab,
      filters: {},
    })

    setDraftFilters({})
    input.onNavigate(href)
    setDrawerOpen(false)
  }

  return (
    <>
      <section className="flex items-center justify-between gap-3 md:hidden">
        <div className="min-w-0 flex-1">
          <TeamAssetTabs
            isNavigating={input.isNavigating}
            onTabChange={input.onTabChange}
            tab={input.data.tab}
          />
        </div>
        <Drawer
          open={drawerOpen}
          onOpenChange={(open) => {
            setDrawerOpen(open)

            if (open) {
              setDraftFilters(input.data.selectedFilters)
            }
          }}
        >
          <DrawerTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="default"
              disabled={input.isNavigating}
              aria-label="Filters"
              className={cn(
                "h-11 w-11 px-0",
                input.data.hasActiveFilters &&
                  "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 aria-expanded:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30",
              )}
            >
              <FilterIcon className="size-4" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
            <DrawerHeader className="shrink-0">
              <DrawerTitle>Filters</DrawerTitle>
            </DrawerHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
              <MobileSelect
                id="mobile-assets-venue-filter"
                label="Venue"
                value={draftFilters.venueId ?? ""}
                options={venueOptions}
                onChange={(value) =>
                  setDraftFilters((currentFilters) => ({
                    ...currentFilters,
                    venueId: value || undefined,
                    campId: undefined,
                    sessionId: undefined,
                  }))
                }
              />
              <MobileSelect
                id="mobile-assets-year-filter"
                label="Year"
                value={typeof draftFilters.year === "number" ? String(draftFilters.year) : ""}
                options={yearOptions}
                onChange={(value) =>
                  setDraftFilters((currentFilters) => ({
                    ...currentFilters,
                    year: value ? Number.parseInt(value, 10) : undefined,
                    campId: undefined,
                    sessionId: undefined,
                  }))
                }
              />
              <MobileSelect
                id="mobile-assets-camp-filter"
                label="Camp"
                value={draftFilters.campId ?? ""}
                options={campOptions}
                onChange={(value) =>
                  setDraftFilters((currentFilters) => ({
                    ...currentFilters,
                    campId: value || undefined,
                    sessionId: undefined,
                  }))
                }
              />
              <MobileSelect
                id="mobile-assets-session-filter"
                label="Session"
                value={draftFilters.sessionId ?? ""}
                options={sessionOptions}
                onChange={(value) =>
                  setDraftFilters((currentFilters) => ({
                    ...currentFilters,
                    sessionId: value || undefined,
                  }))
                }
              />
            </div>

            <DrawerFooter className="shrink-0 border-t">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={input.isNavigating || !input.data.hasActiveFilters}
                onClick={clearFilters}
              >
                Clear
              </Button>
              <Button
                type="button"
                className="h-11 w-full"
                disabled={input.isNavigating}
                onClick={navigateWithDraft}
              >
                Apply
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </section>

      <section className="hidden items-center justify-between gap-3 md:flex">
        <TeamAssetTabs
          isNavigating={input.isNavigating}
          onTabChange={input.onTabChange}
          tab={input.data.tab}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FilterDropdown
            label="Venue"
            options={venueOptions}
            selectedValue={input.data.selectedFilters.venueId ?? ""}
            disabled={input.data.filterOptions.venues.length === 0}
            isNavigating={input.isNavigating}
            onNavigate={input.onNavigate}
          />
          <FilterDropdown
            label="Year"
            options={yearOptions}
            selectedValue={selectedYearValue}
            disabled={input.data.filterOptions.years.length === 0}
            isNavigating={input.isNavigating}
            onNavigate={input.onNavigate}
          />
          <FilterDropdown
            label="Camp"
            options={campOptions}
            selectedValue={input.data.selectedFilters.campId ?? ""}
            disabled={input.data.filterOptions.camps.length === 0}
            isNavigating={input.isNavigating}
            onNavigate={input.onNavigate}
          />
          <FilterDropdown
            label="Session"
            options={sessionOptions}
            selectedValue={input.data.selectedFilters.sessionId ?? ""}
            disabled={input.data.filterOptions.sessions.length === 0}
            isNavigating={input.isNavigating}
            onNavigate={input.onNavigate}
          />
        </div>
      </section>
    </>
  )
}

function MobileSelect(input: {
  id: string
  label: string
  onChange: (value: string) => void
  options: FilterOption[]
  value: string
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={input.id}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {input.label}
      </label>
      <select
        id={input.id}
        value={input.value}
        onChange={(event) => input.onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none ring-ring/50 transition-colors focus-visible:ring-[3px] md:text-sm"
      >
        {input.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
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
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {formatSessionTypeLabel(sessionGroup.sessionType)}
                  </span>
                  <span className="text-muted-foreground">·</span>
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

export function TeamAssetsPageClient(input: {
  initialData: TeamAssetsPageData
  scope: NavigationScope
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [data, setData] = React.useState(input.initialData)
  const [isRoutePending, startRouteTransition] = React.useTransition()
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)
  const currentHref = normalizeInternalHref(
    searchParams.toString().length > 0
      ? `${pathname}?${searchParams.toString()}`
      : pathname,
  )
  const isNavigating = isRoutePending

  React.useEffect(() => {
    setData(input.initialData)
    setIsLoadingMore(false)
  }, [input.initialData])

  function navigateToHref(href: string): void {
    const nextHref = normalizeInternalHref(href)

    if (isNavigating || nextHref === currentHref) {
      return
    }

    startRouteTransition(() => {
      router.push(href)
    })
  }

  function navigateToTab(tab: TeamAssetTab): void {
    navigateToHref(
      buildHref({
        scope: input.scope,
        tab,
        filters: data.selectedFilters,
      }),
    )
  }

  function handleAssetDeleted(assetId: string): void {
    setData((currentData) => {
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
      setData((currentData) => ({
        ...payload.data,
        assets: uniqueAssets(currentData.assets, payload.data.assets),
      }))
      window.history.replaceState(
        null,
        "",
        buildHref({
          scope: input.scope,
          tab: data.tab,
          filters: data.selectedFilters,
          page: nextPage,
          loadMore: true,
        }),
      )
    } catch {
      setData((currentData) => currentData)
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <section className="space-y-4">
      <TeamAssetsToolbar
        data={data}
        isNavigating={isNavigating}
        onTabChange={navigateToTab}
        onNavigate={navigateToHref}
        scope={input.scope}
      />

      <div aria-busy={isNavigating} className="relative">
        <div
          aria-disabled={isNavigating}
          className={cn(
            "space-y-4 transition-opacity",
            isNavigating && "pointer-events-none select-none opacity-40",
          )}
        >
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
                  Load more
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {isNavigating ? (
          <>
            <div className="fixed inset-x-0 bottom-[var(--mobile-bottom-nav-total-height)] top-[var(--mobile-header-total-height)] z-30 flex items-center justify-center bg-background/20 md:hidden">
              <div
                role="status"
                aria-label="Loading assets"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
            <div className="absolute inset-0 z-10 hidden items-center justify-center bg-background/20 md:flex">
              <div
                role="status"
                aria-label="Loading assets"
                className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
              >
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
