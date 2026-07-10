"use client"

import * as React from "react"
import {
  DownloadIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MoreVerticalIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import { toast } from "sonner"

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
import { Skeleton } from "@/components/ui/skeleton"
import {
  deleteSessionAssetAction,
  saveSessionAssetAction,
} from "@/features/sessions/detail-actions"
import {
  buildAssetDownloadUrl,
  SessionAssetCard,
} from "@/features/assets/asset-browser-grid"
import type { SessionDetailAsset } from "@/features/sessions/detail-types"
import type { NavigationScope } from "@/lib/navigation/types"

const SESSION_PHOTO_MAX_DIMENSION = 720
const SESSION_PHOTO_MAX_BYTES = 2 * 1024 * 1024
const SESSION_PHOTO_THUMBNAIL_MAX_DIMENSION = 320
const SESSION_PHOTO_THUMBNAIL_MAX_BYTES = 256 * 1024
const SESSION_PHOTO_WEBP_TYPE = "image/webp"
const SESSION_PHOTO_QUALITY_LADDER = [0.55, 0.48, 0.42] as const
const SESSION_PHOTO_THUMBNAIL_QUALITY_LADDER = [0.5, 0.44, 0.38] as const

type PendingAssetUpload = {
  fileName: string
  statusLabel: string
}

type DecodedImageSource = {
  source: CanvasImageSource
  width: number
  height: number
  cleanup: () => void
}

type CompressedSessionPhotoFiles = {
  displayFile: File
  thumbnailFile: File
}

function buildCompressedPhotoFileName(fileName: string, suffix = ""): string {
  const normalizedName = fileName.trim()
  const baseName =
    normalizedName.length > 0
      ? normalizedName.replace(/\.[^/.]+$/, "")
      : "session-image"

  return `${baseName || "session-image"}${suffix}.webp`
}

async function decodeImageSource(file: File): Promise<DecodedImageSource> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await window.createImageBitmap(file)

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      }
    } catch {
      // Fall through to the image element path.
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      })
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Could not read this image."))
    }
    image.src = objectUrl
  })
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress this image."))
          return
        }

        resolve(blob)
      },
      SESSION_PHOTO_WEBP_TYPE,
      quality,
    )
  })
}

async function encodeSessionPhotoFile(input: {
  decodedImage: DecodedImageSource
  fileName: string
  maxBytes: number
  maxDimension: number
  qualityLadder: readonly number[]
  suffix?: string
}): Promise<File> {
  const maxSourceDimension = Math.max(input.decodedImage.width, input.decodedImage.height)
  const scale = Math.min(1, input.maxDimension / maxSourceDimension)
  const targetWidth = Math.max(1, Math.round(input.decodedImage.width * scale))
  const targetHeight = Math.max(1, Math.round(input.decodedImage.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Could not prepare this image.")
  }

  context.drawImage(input.decodedImage.source, 0, 0, targetWidth, targetHeight)

  let compressedBlob: Blob | null = null

  for (const quality of input.qualityLadder) {
    compressedBlob = await canvasToWebpBlob(canvas, quality)

    if (compressedBlob.size <= input.maxBytes) {
      break
    }
  }

  if (!compressedBlob) {
    throw new Error("Could not compress this image.")
  }

  if (compressedBlob.type !== SESSION_PHOTO_WEBP_TYPE) {
    throw new Error("This browser could not create a WebP image.")
  }

  if (compressedBlob.size > input.maxBytes) {
    throw new Error("This image is still too large after compression.")
  }

  return new File([compressedBlob], buildCompressedPhotoFileName(input.fileName, input.suffix), {
    type: SESSION_PHOTO_WEBP_TYPE,
    lastModified: Date.now(),
  })
}

async function compressSessionPhotoFiles(file: File): Promise<CompressedSessionPhotoFiles> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Select an image file.")
  }

  const decodedImage = await decodeImageSource(file)

  try {
    const displayFile = await encodeSessionPhotoFile({
      decodedImage,
      fileName: file.name,
      maxBytes: SESSION_PHOTO_MAX_BYTES,
      maxDimension: SESSION_PHOTO_MAX_DIMENSION,
      qualityLadder: SESSION_PHOTO_QUALITY_LADDER,
    })
    const thumbnailFile = await encodeSessionPhotoFile({
      decodedImage,
      fileName: file.name,
      maxBytes: SESSION_PHOTO_THUMBNAIL_MAX_BYTES,
      maxDimension: SESSION_PHOTO_THUMBNAIL_MAX_DIMENSION,
      qualityLadder: SESSION_PHOTO_THUMBNAIL_QUALITY_LADDER,
      suffix: "-thumb",
    })

    return {
      displayFile,
      thumbnailFile,
    }
  } finally {
    decodedImage.cleanup()
  }
}

function AssetActions(input: {
  asset: SessionDetailAsset
  canManageSession: boolean
  onAssetsChanged: () => Promise<void> | void
  onDeletingChange: (isDeleting: boolean) => void
  scope: NavigationScope
  sessionId: string
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
      formData.set("sessionId", input.sessionId)
      formData.set("assetId", input.asset.id)
      formData.set("scopeOrgId", input.scope.activeOrgId)
      if (input.scope.activeTeamId) {
        formData.set("scopeTeamId", input.scope.activeTeamId)
      }

      const result = await deleteSessionAssetAction(formData)

      if (!result.ok) {
        toast.error(result.message)
        setIsDeleting(false)
        input.onDeletingChange(false)
        return
      }

      toast.success(input.asset.asset_type === "photo" ? "Image deleted." : "File deleted.")
      setDeleteDialogOpen(false)
      await input.onAssetsChanged()
      setIsDeleting(false)
      input.onDeletingChange(false)
    } catch {
      toast.error("Could not delete this file. Confirm storage is available and try again.")
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
          <span className="sr-only">File actions</span>
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

          {input.canManageSession ? (
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
              This removes the asset from this session and deletes the stored file.
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

function AssetCard(input: {
  asset: SessionDetailAsset
  canManageSession: boolean
  onAssetsChanged: () => Promise<void> | void
  scope: NavigationScope
  sessionId: string
}) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  return (
    <SessionAssetCard
      asset={input.asset}
      busyLabel="Deleting file"
      isBusy={isDeleting}
      overlayActions={
        <AssetActions
          asset={input.asset}
          canManageSession={input.canManageSession}
          onAssetsChanged={input.onAssetsChanged}
          onDeletingChange={setIsDeleting}
          scope={input.scope}
          sessionId={input.sessionId}
        />
      }
    />
  )
}

function PendingAssetCard(input: {
  pendingUpload: PendingAssetUpload
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex aspect-[4/3] items-center justify-center bg-muted">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
      <div className="space-y-1.5 p-2.5 sm:space-y-2 sm:p-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Skeleton className="size-3.5 shrink-0 rounded-full sm:size-4" />
          <p className="truncate text-xs font-medium sm:text-sm">{input.pendingUpload.fileName}</p>
        </div>
        <p className="text-[0.7rem] leading-tight text-muted-foreground sm:text-xs">
          {input.pendingUpload.statusLabel}
        </p>
      </div>
    </div>
  )
}

function AssetGrid(input: {
  assets: SessionDetailAsset[]
  canManageSession: boolean
  emptyMessage: string
  onAssetsChanged: () => Promise<void> | void
  pendingUpload: PendingAssetUpload | null
  scope: NavigationScope
  sessionId: string
}) {
  if (input.assets.length === 0 && !input.pendingUpload) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
        {input.emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {input.pendingUpload ? <PendingAssetCard pendingUpload={input.pendingUpload} /> : null}
      {input.assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          canManageSession={input.canManageSession}
          onAssetsChanged={input.onAssetsChanged}
          scope={input.scope}
          sessionId={input.sessionId}
        />
      ))}
    </div>
  )
}

export function SessionAssetsPanel(input: {
  title: string
  description?: string
  emptyMessage: string
  sessionId: string
  scope: NavigationScope
  assetType: "photo" | "analytics_file"
  tab: "images" | "analytics"
  accept: string
  buttonLabel: string
  assets: SessionDetailAsset[]
  assetLimit: number
  assetTotalCount: number
  canManageSession: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  onAssetsChanged: () => Promise<void> | void
}) {
  const inputId = React.useId()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = React.useState<PendingAssetUpload | null>(null)
  const isUploading = pendingUpload !== null
  const description = input.description?.trim()
  const hasMoreAssets = input.assets.length < input.assetTotalCount

  async function handleSelectedFile(file: File): Promise<void> {
    setPendingUpload({
      fileName: file.name,
      statusLabel: input.assetType === "photo" ? "Compressing..." : "Uploading...",
    })

    try {
      const compressedPhotoFiles =
        input.assetType === "photo" ? await compressSessionPhotoFiles(file) : null
      const assetFile = compressedPhotoFiles?.displayFile ?? file

      setPendingUpload({
        fileName: assetFile.name,
        statusLabel: "Uploading...",
      })

      const formData = new FormData()
      formData.set("sessionId", input.sessionId)
      formData.set("assetType", input.assetType)
      formData.set("scopeOrgId", input.scope.activeOrgId)
      if (input.scope.activeTeamId) {
        formData.set("scopeTeamId", input.scope.activeTeamId)
      }
      formData.set("scopeTab", input.tab)
      formData.set("assetFile", assetFile)
      if (compressedPhotoFiles) {
        formData.set("thumbnailFile", compressedPhotoFiles.thumbnailFile)
      }

      const result = await saveSessionAssetAction(formData)

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(input.assetType === "photo" ? "Image uploaded." : "File uploaded.")
      await input.onAssetsChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload this file.")
    } finally {
      setPendingUpload(null)
    }
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""

    if (!file || isUploading) {
      return
    }

    void handleSelectedFile(file)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{input.title}</h3>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {input.canManageSession ? (
          <div>
            <input
              ref={fileInputRef}
              id={inputId}
              type="file"
              accept={input.accept}
              disabled={isUploading}
              onChange={handleFileInputChange}
              className="hidden"
              aria-label={input.buttonLabel}
            />
            <Button
              type="button"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <UploadIcon className="size-4" />
              )}
              {input.buttonLabel}
            </Button>
          </div>
        ) : null}
      </div>

      <AssetGrid
        assets={input.assets}
        canManageSession={input.canManageSession}
        emptyMessage={input.emptyMessage}
        onAssetsChanged={input.onAssetsChanged}
        pendingUpload={pendingUpload}
        scope={input.scope}
        sessionId={input.sessionId}
      />

      {input.assetTotalCount > input.assetLimit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <span>
            Showing {input.assets.length} of {input.assetTotalCount}.
          </span>
          {hasMoreAssets && input.onLoadMore ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={input.isLoadingMore}
              onClick={input.onLoadMore}
            >
              {input.isLoadingMore ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <PlusIcon className="size-4" />
              )}
              Load more
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export type SessionAssetsPanelProps = Parameters<typeof SessionAssetsPanel>[0]
