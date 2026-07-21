"use client"

import Link from "next/link"
import * as React from "react"
import {
  FileTextIcon,
  Loader2Icon,
  MoreVerticalIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  formatAssetSize,
  formatAssetUploadedAt,
} from "@/features/assets/asset-browser-grid"
import {
  deleteSessionAssetAction,
  saveSessionGpsFileAction,
} from "@/features/sessions/detail-actions"
import { ProFeatureUpgradeDialog } from "@/features/billing/free-tier-quota-dialog"
import { VakarosPlayer } from "@/features/sessions/detail/vakaros-player"
import type { SessionDetailGpsFile } from "@/features/sessions/detail-types"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type SessionGpsFileUploadBlockReason = "plan_limit_reached" | "payment_required" | null
type SessionGpsFileUploadIconPosition = "end" | "start"
type SessionGpsFileUploadTriggerIcon = "play" | "plus" | "upload"

export type SessionGpsFileCardAsset = SessionDetailGpsFile

export type SessionGpsFileUploadSurfaceProps = {
  buttonClassName?: string
  iconPosition?: SessionGpsFileUploadIconPosition
  buttonLabel: string
  onGpsFilesChanged: () => Promise<void> | void
  scope: NavigationScope
  sessionId: string
  triggerIconClassName?: string
  triggerIcon?: SessionGpsFileUploadTriggerIcon
}

export type SessionGpsFilePlayerDialogProps = {
  gpsFile: SessionGpsFileCardAsset
  onOpenChange: (open: boolean) => void
  open: boolean
}

function buildSubscriptionHref(scope: NavigationScope): string {
  const params = new URLSearchParams({
    org: scope.activeOrgId,
    tab: "billing",
  })

  if (scope.activeTeamId) {
    params.set("team", scope.activeTeamId)
  }

  return `/subscription?${params.toString()}`
}

function getUploadBlockedMessage(reason: SessionGpsFileUploadBlockReason): string {
  if (reason === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Subscription to continue uploading files."
  }

  if (reason === "plan_limit_reached") {
    return "This is a Pro feature. Upgrade to Pro to continue uploading files."
  }

  return "Uploads are unavailable for this organization."
}

function normalizeGpsDescription(value: string): string {
  return value.trim().slice(0, 4000)
}

function formatGpsNumber(value: number | null | undefined, suffix: string, decimals = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-"
  }

  return `${value.toFixed(decimals)}${suffix}`
}

function formatGpsDuration(hours: number | null | undefined): string {
  if (typeof hours !== "number" || !Number.isFinite(hours)) {
    return "-"
  }

  const totalMinutes = Math.round(hours * 60)
  const durationHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return durationHours > 0 ? `${durationHours}h ${minutes}m` : `${minutes}m`
}

export function SessionGpsFileUploadSurface(input: SessionGpsFileUploadSurfaceProps) {
  const inputId = React.useId()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [description, setDescription] = React.useState("")
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const TriggerIcon =
    input.triggerIcon === "play" ? PlayIcon : input.triggerIcon === "plus" ? PlusIcon : UploadIcon
  const triggerIconPosition = input.iconPosition ?? "start"
  const triggerContent = (
    <>
      {triggerIconPosition === "start" ? (
        <TriggerIcon className={cn("size-4", input.triggerIconClassName)} />
      ) : null}
      {input.buttonLabel}
      {triggerIconPosition === "end" ? (
        <TriggerIcon className={cn("size-4", input.triggerIconClassName)} />
      ) : null}
    </>
  )

  function resetUploadForm(): void {
    setDescription("")
    setSelectedFile(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function handleOpenChange(nextOpen: boolean): void {
    if (isUploading) {
      return
    }

    setIsOpen(nextOpen)

    if (!nextOpen) {
      resetUploadForm()
    }
  }

  async function uploadSelectedFile(): Promise<void> {
    if (!selectedFile) {
      toast.error("Choose a Vakaros CSV file.")
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.set("sessionId", input.sessionId)
      formData.set("scopeOrgId", input.scope.activeOrgId)
      if (input.scope.activeTeamId) {
        formData.set("scopeTeamId", input.scope.activeTeamId)
      }
      formData.set("scopeTab", "analytics")
      formData.set("gpsFile", selectedFile)
      const normalizedDescription = normalizeGpsDescription(description)
      if (normalizedDescription.length > 0) {
        formData.set("description", normalizedDescription)
      }

      const result = await saveSessionGpsFileAction(formData)

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success("GPS file uploaded.")
      resetUploadForm()
      setIsOpen(false)
      await input.onGpsFilesChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload GPS file.")
    } finally {
      setIsUploading(false)
    }
  }

  const content = (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          disabled={isUploading}
          onChange={(event) => {
            setSelectedFile(event.currentTarget.files?.[0] ?? null)
          }}
          className="hidden"
          aria-label="Choose Vakaros CSV"
        />

        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            disabled={isUploading}
            className={isMobile ? "h-11 w-full" : undefined}
            onClick={() => fileInputRef.current?.click()}
          >
            <PlusIcon className="size-4" />
            Choose CSV
          </Button>
          {selectedFile ? (
            <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-card p-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileTextIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatAssetSize(selectedFile.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size={isMobile ? "icon" : "icon-sm"}
                className={isMobile ? "h-11 w-11" : undefined}
                disabled={isUploading}
                onClick={() => setSelectedFile(null)}
              >
                <XIcon className="size-4" />
                <span className="sr-only">Remove selected GPS file</span>
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              Choose one Vakaros CSV before uploading.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor={`${inputId}-description`} className="text-sm font-medium">
            Description
          </label>
          <Textarea
            id={`${inputId}-description`}
            value={description}
            maxLength={4000}
            disabled={isUploading}
            placeholder="Add a description for this GPS file."
            className={isMobile ? "min-h-28 resize-none text-base" : "min-h-24 resize-none"}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </div>
      </div>

      {isMobile ? (
        <DrawerFooter className="shrink-0 border-t">
          <Button
            type="button"
            className="h-11 w-full"
            disabled={isUploading || !selectedFile}
            onClick={() => {
              void uploadSelectedFile()
            }}
          >
            {isUploading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <UploadIcon className="size-4" />
            )}
            Upload GPS File
          </Button>
        </DrawerFooter>
      ) : (
        <SheetFooter className="shrink-0 border-t px-4 py-3">
          <Button
            type="button"
            disabled={isUploading || !selectedFile}
            onClick={() => {
              void uploadSelectedFile()
            }}
          >
            {isUploading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <UploadIcon className="size-4" />
            )}
            Upload GPS File
          </Button>
        </SheetFooter>
      )}
    </>
  )

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <Button
            type="button"
            variant="default"
            className={cn("h-11", input.buttonClassName)}
            disabled={isUploading}
          >
            {triggerContent}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[var(--mobile-drawer-max-height)]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Upload GPS File</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="default"
            size="sm"
            className={input.buttonClassName}
            disabled={isUploading}
          />
        }
      >
        {triggerContent}
      </SheetTrigger>
      <SheetContent side="right" className="h-full overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>Upload GPS File</SheetTitle>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  )
}

export function SessionGpsFilePlayerDialog(input: SessionGpsFilePlayerDialogProps) {
  return (
    <Dialog open={input.open} onOpenChange={input.onOpenChange}>
      <DialogContent
        className="grid h-dvh max-h-dvh w-screen max-w-none grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-none border-0 p-3 sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-6xl sm:rounded-xl sm:border sm:p-4"
        forceOverlayRender
        overlayClassName="bg-black/35 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader className="min-w-0">
          <DialogTitle className="truncate pr-10">{input.gpsFile.file_name}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0">
          <VakarosPlayer
            fileName={input.gpsFile.file_name}
            series1HzUrl={input.gpsFile.gpsArtifacts.series1HzUrl}
            trackGeojsonUrl={input.gpsFile.gpsArtifacts.trackGeojsonUrl}
            className="h-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SessionGpsFileCard(input: {
  canManageSession: boolean
  gpsFile: SessionGpsFileCardAsset
  onGpsFileDeleted?: (assetId: string) => void
  onGpsFilesChanged?: () => Promise<void> | void
  scope: NavigationScope
  sessionId: string
}) {
  const [playerOpen, setPlayerOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const description = input.gpsFile.description?.trim()

  async function handleDelete(): Promise<void> {
    if (isDeleting) {
      return
    }

    setIsDeleting(true)

    try {
      const formData = new FormData()
      formData.set("sessionId", input.sessionId)
      formData.set("assetId", input.gpsFile.id)
      formData.set("scopeOrgId", input.scope.activeOrgId)
      if (input.scope.activeTeamId) {
        formData.set("scopeTeamId", input.scope.activeTeamId)
      }
      formData.set("scopeTab", "analytics")
      const result = await deleteSessionAssetAction(formData)

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success("GPS file deleted.")
      setDeleteDialogOpen(false)
      input.onGpsFileDeleted?.(input.gpsFile.id)
      await input.onGpsFilesChanged?.()
    } catch {
      toast.error("Could not delete GPS file.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div
        className="group relative overflow-hidden rounded-lg border bg-card shadow-sm transition-colors hover:bg-muted/40"
        aria-busy={isDeleting}
      >
        {isDeleting ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/80 text-muted-foreground backdrop-blur-sm">
            <Loader2Icon className="size-6 animate-spin" />
            <span className="sr-only">Deleting GPS file</span>
          </div>
        ) : null}
        <button
          type="button"
          disabled={isDeleting}
          className="block h-full w-full text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => setPlayerOpen(true)}
        >
          <div className="flex aspect-[4/3] items-center justify-center border-b bg-muted text-muted-foreground">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <PlayIcon className="ml-0.5 size-6" />
            </div>
          </div>
          <div className="space-y-2 p-2.5 sm:p-3">
            <div className="flex min-w-0 items-center gap-1.5 pr-7 sm:gap-2 sm:pr-8">
              <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
              <p className="truncate text-xs font-medium sm:text-sm">{input.gpsFile.file_name}</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[0.7rem] leading-tight text-muted-foreground sm:text-xs">
              <span>{formatGpsDuration(input.gpsFile.vakaros?.durationHours)}</span>
              <span>{formatGpsNumber(input.gpsFile.vakaros?.distanceNm, " nm", 1)}</span>
              <span>{formatGpsNumber(input.gpsFile.vakaros?.avgSogKts, " kt", 1)} avg</span>
              <span>{formatGpsNumber(input.gpsFile.vakaros?.maxSogKts, " kt", 1)} max</span>
            </div>
            <p className="truncate text-[0.7rem] leading-tight text-muted-foreground sm:text-xs">
              {formatAssetUploadedAt(input.gpsFile.created_at)}
            </p>
            {description ? (
              <p className="line-clamp-2 text-[0.7rem] leading-tight text-muted-foreground sm:text-xs">
                {description}
              </p>
            ) : null}
          </div>
        </button>

        {input.canManageSession ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1.5 right-1.5 z-10 bg-background/90 shadow-sm hover:bg-background sm:top-2 sm:right-2"
                  disabled={isDeleting}
                />
              }
            >
              <MoreVerticalIcon className="size-4" />
              <span className="sr-only">GPS file actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem
                variant="destructive"
                disabled={isDeleting}
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2Icon className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <SessionGpsFilePlayerDialog
        gpsFile={input.gpsFile}
        open={playerOpen}
        onOpenChange={setPlayerOpen}
      />

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
            <DialogTitle>Delete GPS file?</DialogTitle>
            <DialogDescription>
              This removes the GPS file from this session and deletes the stored artifacts.
            </DialogDescription>
          </DialogHeader>

          <p className="truncate text-sm font-medium">{input.gpsFile.file_name}</p>

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
                void handleDelete()
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

function SessionGpsFileGrid(input: {
  canManageSession: boolean
  emptyMessage: string
  gpsFiles: SessionDetailGpsFile[]
  onGpsFilesChanged: () => Promise<void> | void
  scope: NavigationScope
  sessionId: string
}) {
  if (input.gpsFiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
        {input.emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:gap-3 xl:grid-cols-2">
      {input.gpsFiles.map((gpsFile) => (
        <SessionGpsFileCard
          key={gpsFile.id}
          gpsFile={gpsFile}
          canManageSession={input.canManageSession}
          onGpsFilesChanged={input.onGpsFilesChanged}
          scope={input.scope}
          sessionId={input.sessionId}
        />
      ))}
    </div>
  )
}

export function SessionGpsFilesPanel(input: {
  assetUploadBlockReason?: SessionGpsFileUploadBlockReason
  canManageSession: boolean
  canUploadAssets: boolean
  emptyMessage: string
  gpsFileTotalCount: number
  gpsFiles: SessionDetailGpsFile[]
  onGpsFilesChanged: () => Promise<void> | void
  scope: NavigationScope
  sessionId: string
}) {
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = React.useState(false)
  const canUploadAssets = input.canManageSession && input.canUploadAssets
  const isPlanLimitBlocked =
    input.canManageSession &&
    !input.canUploadAssets &&
    input.assetUploadBlockReason === "plan_limit_reached"
  const shouldShowSubscriptionBlockMessage =
    input.canManageSession && !input.canUploadAssets && !isPlanLimitBlocked
  const subscriptionHref = buildSubscriptionHref(input.scope)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">GPS Files</h3>
        </div>

        {canUploadAssets ? (
          <SessionGpsFileUploadSurface
            buttonLabel="Upload GPS File"
            onGpsFilesChanged={input.onGpsFilesChanged}
            scope={input.scope}
            sessionId={input.sessionId}
          />
        ) : isPlanLimitBlocked ? (
          <Button
            type="button"
            variant="outline"
            aria-haspopup="dialog"
            onClick={() => setIsUpgradeDialogOpen(true)}
          >
            <UploadIcon className="size-4" />
            Upload GPS File
          </Button>
        ) : null}
      </div>

      {isPlanLimitBlocked ? (
        <ProFeatureUpgradeDialog
          organizationId={input.scope.activeOrgId}
          teamId={input.scope.activeTeamId}
          open={isUpgradeDialogOpen}
          onOpenChange={setIsUpgradeDialogOpen}
          description="GPS file uploads are available on Pro. Upgrade to attach session tracks and unlock higher creation limits."
        />
      ) : null}

      {shouldShowSubscriptionBlockMessage ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{getUploadBlockedMessage(input.assetUploadBlockReason ?? null)}</p>
          <Link
            href={subscriptionHref}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "bg-background",
            })}
          >
            {input.assetUploadBlockReason === "payment_required"
              ? "Open Subscription"
              : "Upgrade to Pro"}
          </Link>
        </div>
      ) : null}

      <SessionGpsFileGrid
        canManageSession={input.canManageSession}
        emptyMessage={input.emptyMessage}
        gpsFiles={input.gpsFiles}
        onGpsFilesChanged={input.onGpsFilesChanged}
        scope={input.scope}
        sessionId={input.sessionId}
      />

      {input.gpsFileTotalCount > input.gpsFiles.length ? (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Showing {input.gpsFiles.length} of {input.gpsFileTotalCount}.
        </div>
      ) : null}
    </div>
  )
}

export type SessionGpsFilesPanelProps = Parameters<typeof SessionGpsFilesPanel>[0]
