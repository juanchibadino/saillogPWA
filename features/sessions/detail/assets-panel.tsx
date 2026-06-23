"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  ImageIcon,
  Loader2Icon,
  MinusIcon,
  MoreVerticalIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
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
  DialogTrigger,
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
} from "@/features/sessions/actions"
import type { SessionDetailAsset } from "@/features/sessions/detail-types"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

function formatAssetSize(sizeBytes: number | null): string {
  if (typeof sizeBytes !== "number" || sizeBytes < 0) {
    return "Size unknown"
  }

  if (sizeBytes < 1024) {
    return String(sizeBytes) + " B"
  }

  if (sizeBytes < 1024 * 1024) {
    return (sizeBytes / 1024).toFixed(1) + " KB"
  }

  return (sizeBytes / (1024 * 1024)).toFixed(1) + " MB"
}

function formatAssetUploadedAt(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown date"
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date)
}

const SESSION_PHOTO_MAX_DIMENSION = 720
const SESSION_PHOTO_MAX_BYTES = 2 * 1024 * 1024
const SESSION_PHOTO_WEBP_TYPE = "image/webp"
const SESSION_PHOTO_QUALITY_LADDER = [0.55, 0.48, 0.42] as const

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

type ImagePreviewPointerPosition = {
  x: number
  y: number
}

const MIN_IMAGE_PREVIEW_ZOOM = 1
const MAX_IMAGE_PREVIEW_ZOOM = 3
const IMAGE_PREVIEW_ZOOM_STEP = 0.35
const IMAGE_PREVIEW_PINCH_SENSITIVITY = 0.5

function clampImagePreviewZoom(value: number): number {
  return Math.min(MAX_IMAGE_PREVIEW_ZOOM, Math.max(MIN_IMAGE_PREVIEW_ZOOM, value))
}

function getPointerDistance(
  first: ImagePreviewPointerPosition,
  second: ImagePreviewPointerPosition,
): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function AssetImageFallback(input: {
  isImage: boolean
}) {
  return (
    <div className="flex h-full min-h-32 w-full items-center justify-center bg-muted text-muted-foreground">
      {input.isImage ? <ImageIcon className="size-8" /> : <FileIcon className="size-8" />}
    </div>
  )
}

function AssetThumbnailSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
      <Loader2Icon className="size-5 animate-spin" />
      <span className="sr-only">Loading thumbnail</span>
    </div>
  )
}

function buildCompressedPhotoFileName(fileName: string): string {
  const normalizedName = fileName.trim()
  const baseName =
    normalizedName.length > 0
      ? normalizedName.replace(/\.[^/.]+$/, "")
      : "session-image"

  return `${baseName || "session-image"}.webp`
}

function getAssetExtension(fileName: string): string {
  const parts = fileName.split(".")
  const extension = parts.length > 1 ? parts.at(-1) : null
  return extension ? extension.slice(0, 5).toUpperCase() : "FILE"
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

async function compressSessionPhotoFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Select an image file.")
  }

  const decodedImage = await decodeImageSource(file)

  try {
    const maxSourceDimension = Math.max(decodedImage.width, decodedImage.height)
    const scale = Math.min(1, SESSION_PHOTO_MAX_DIMENSION / maxSourceDimension)
    const targetWidth = Math.max(1, Math.round(decodedImage.width * scale))
    const targetHeight = Math.max(1, Math.round(decodedImage.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Could not prepare this image.")
    }

    context.drawImage(decodedImage.source, 0, 0, targetWidth, targetHeight)

    let compressedBlob: Blob | null = null

    for (const quality of SESSION_PHOTO_QUALITY_LADDER) {
      compressedBlob = await canvasToWebpBlob(canvas, quality)

      if (compressedBlob.size <= SESSION_PHOTO_MAX_BYTES) {
        break
      }
    }

    if (!compressedBlob) {
      throw new Error("Could not compress this image.")
    }

    if (compressedBlob.type !== SESSION_PHOTO_WEBP_TYPE) {
      throw new Error("This browser could not create a WebP image.")
    }

    if (compressedBlob.size > SESSION_PHOTO_MAX_BYTES) {
      throw new Error("This image is still too large after compression.")
    }

    return new File([compressedBlob], buildCompressedPhotoFileName(file.name), {
      type: SESSION_PHOTO_WEBP_TYPE,
      lastModified: Date.now(),
    })
  } finally {
    decodedImage.cleanup()
  }
}

function AssetThumbnail(input: {
  asset: SessionDetailAsset
}) {
  const isImage = input.asset.asset_type === "photo"
  const [imageStatus, setImageStatus] = React.useState<"loading" | "loaded" | "error">(
    isImage && input.asset.signedUrl ? "loading" : "error",
  )

  React.useEffect(() => {
    setImageStatus(isImage && input.asset.signedUrl ? "loading" : "error")
  }, [input.asset.signedUrl, isImage])

  if (isImage && input.asset.signedUrl && imageStatus !== "error") {
    return (
      <div className="relative h-full w-full">
        {imageStatus === "loading" ? <AssetThumbnailSpinner /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={input.asset.signedUrl}
          alt=""
          loading="lazy"
          onLoad={() => setImageStatus("loaded")}
          onError={() => setImageStatus("error")}
          className={cn(
            "h-full w-full object-contain transition-opacity duration-150",
            imageStatus === "loading" ? "opacity-0" : "opacity-100",
          )}
        />
      </div>
    )
  }

  return <AssetImageFallback isImage={isImage} />
}

function ZoomableAssetImage(input: {
  src: string
  alt: string
}) {
  const viewerRootRef = React.useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)
  const pointersRef = React.useRef<Map<number, ImagePreviewPointerPosition>>(new Map())
  const pinchRef = React.useRef<{ distance: number; scale: number } | null>(null)
  const scaleRef = React.useRef(MIN_IMAGE_PREVIEW_ZOOM)
  const offsetRef = React.useRef<ImagePreviewPointerPosition>({ x: 0, y: 0 })
  const [scale, setScale] = React.useState(MIN_IMAGE_PREVIEW_ZOOM)
  const [offset, setOffset] = React.useState<ImagePreviewPointerPosition>({ x: 0, y: 0 })
  const [hasImageError, setHasImageError] = React.useState(false)
  const canZoomOut = scale > MIN_IMAGE_PREVIEW_ZOOM
  const canZoomIn = scale < MAX_IMAGE_PREVIEW_ZOOM

  const updateOffset = React.useCallback((nextOffset: ImagePreviewPointerPosition): void => {
    const scrollContainer = scrollContainerRef.current
    const currentScale = scaleRef.current

    if (!scrollContainer || currentScale <= MIN_IMAGE_PREVIEW_ZOOM) {
      const resetOffset = { x: 0, y: 0 }
      offsetRef.current = resetOffset
      setOffset(resetOffset)
      return
    }

    const maxOffsetX = (scrollContainer.clientWidth * (currentScale - 1)) / 2
    const maxOffsetY = (scrollContainer.clientHeight * (currentScale - 1)) / 2
    const clampedOffset = {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, nextOffset.x)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, nextOffset.y)),
    }

    offsetRef.current = clampedOffset
    setOffset(clampedOffset)
  }, [])

  const updateScale = React.useCallback(
    (nextScale: number): void => {
      const clampedScale = clampImagePreviewZoom(nextScale)
      scaleRef.current = clampedScale
      setScale(clampedScale)
      updateOffset(offsetRef.current)
    },
    [updateOffset],
  )

  React.useEffect(() => {
    scaleRef.current = MIN_IMAGE_PREVIEW_ZOOM
    offsetRef.current = { x: 0, y: 0 }
    setScale(MIN_IMAGE_PREVIEW_ZOOM)
    setOffset({ x: 0, y: 0 })
    setHasImageError(false)
    pointersRef.current.clear()
    pinchRef.current = null
  }, [input.src])

  React.useEffect(() => {
    const viewerRoot = viewerRootRef.current

    if (!viewerRoot) {
      return
    }

    const listenerOptions: AddEventListenerOptions = { capture: true, passive: false }

    const handleNativeWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey && scaleRef.current <= MIN_IMAGE_PREVIEW_ZOOM) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (event.ctrlKey || event.metaKey) {
        const zoomDelta = Math.max(-0.12, Math.min(0.12, event.deltaY * -0.0018))
        updateScale(scaleRef.current + zoomDelta)
        return
      }

      updateOffset({
        x: offsetRef.current.x - event.deltaX,
        y: offsetRef.current.y - event.deltaY,
      })
    }

    const preventBrowserTouchZoom = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
    }

    const preventBrowserGesture = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
    }

    viewerRoot.addEventListener("wheel", handleNativeWheel, listenerOptions)
    viewerRoot.addEventListener("touchstart", preventBrowserTouchZoom, listenerOptions)
    viewerRoot.addEventListener("touchmove", preventBrowserTouchZoom, listenerOptions)
    viewerRoot.addEventListener("gesturestart", preventBrowserGesture, listenerOptions)
    viewerRoot.addEventListener("gesturechange", preventBrowserGesture, listenerOptions)
    viewerRoot.addEventListener("gestureend", preventBrowserGesture, listenerOptions)

    return () => {
      viewerRoot.removeEventListener("wheel", handleNativeWheel, listenerOptions)
      viewerRoot.removeEventListener("touchstart", preventBrowserTouchZoom, listenerOptions)
      viewerRoot.removeEventListener("touchmove", preventBrowserTouchZoom, listenerOptions)
      viewerRoot.removeEventListener("gesturestart", preventBrowserGesture, listenerOptions)
      viewerRoot.removeEventListener("gesturechange", preventBrowserGesture, listenerOptions)
      viewerRoot.removeEventListener("gestureend", preventBrowserGesture, listenerOptions)
    }
  }, [updateOffset, updateScale])

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })

    const pointers = Array.from(pointersRef.current.values())
    if (pointers.length === 2) {
      pinchRef.current = {
        distance: getPointerDistance(pointers[0], pointers[1]),
        scale: scaleRef.current,
      }
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    event.preventDefault()
    event.stopPropagation()
    const previousPointer = pointersRef.current.get(event.pointerId)
    if (!previousPointer) {
      return
    }

    const nextPointer = {
      x: event.clientX,
      y: event.clientY,
    }

    if (pointersRef.current.size === 1) {
      if (scaleRef.current > MIN_IMAGE_PREVIEW_ZOOM) {
        updateOffset({
          x: offsetRef.current.x + nextPointer.x - previousPointer.x,
          y: offsetRef.current.y + nextPointer.y - previousPointer.y,
        })
      }

      pointersRef.current.set(event.pointerId, nextPointer)
      return
    }

    pointersRef.current.set(event.pointerId, nextPointer)

    const pointers = Array.from(pointersRef.current.values())
    if (pointers.length < 2 || !pinchRef.current) {
      return
    }

    const nextDistance = getPointerDistance(pointers[0], pointers[1])
    if (nextDistance <= 0 || pinchRef.current.distance <= 0) {
      return
    }

    const rawRatio = nextDistance / pinchRef.current.distance
    const dampedRatio = 1 + (rawRatio - 1) * IMAGE_PREVIEW_PINCH_SENSITIVITY
    updateScale(pinchRef.current.scale * dampedRatio)
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>): void {
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    pointersRef.current.delete(event.pointerId)

    const pointers = Array.from(pointersRef.current.values())
    if (pointers.length === 2) {
      pinchRef.current = {
        distance: getPointerDistance(pointers[0], pointers[1]),
        scale: scaleRef.current,
      }
      return
    }

    pinchRef.current = null
  }

  function handleDoubleClick(): void {
    updateScale(scaleRef.current > MIN_IMAGE_PREVIEW_ZOOM ? MIN_IMAGE_PREVIEW_ZOOM : 1.75)
  }

  return (
    <div
      ref={viewerRootRef}
      className="relative h-full min-w-0 select-none overflow-hidden rounded-lg border bg-background sm:h-[68dvh]"
    >
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex h-full min-h-0 w-full touch-none items-center justify-center overflow-hidden overscroll-contain bg-muted/20",
          scale > MIN_IMAGE_PREVIEW_ZOOM ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
        )}
        onDoubleClick={handleDoubleClick}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        style={{ touchAction: "none" }}
      >
        {hasImageError ? (
          <AssetImageFallback isImage />
        ) : (
          <div className="flex h-full min-h-0 w-full min-w-0 items-center justify-center p-2 sm:p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={input.src}
              alt={input.alt}
              draggable={false}
              onError={() => setHasImageError(true)}
              className="max-h-full max-w-full touch-none select-none object-contain will-change-transform"
              style={{
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
                transformOrigin: "center center",
                touchAction: "none",
              }}
            />
          </div>
        )}
      </div>

      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-lg bg-background/90 p-1 shadow-sm ring-1 ring-border backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="Zoom out"
          disabled={!canZoomOut}
          onClick={() => updateScale(scale - IMAGE_PREVIEW_ZOOM_STEP)}
        >
          <MinusIcon className="size-3" />
          <span className="sr-only">Zoom out</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          title="Reset zoom"
          className="min-w-10 px-1.5 tabular-nums"
          disabled={!canZoomOut}
          onClick={() => updateScale(MIN_IMAGE_PREVIEW_ZOOM)}
        >
          {Math.round(scale * 100)}%
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="Zoom in"
          disabled={!canZoomIn}
          onClick={() => updateScale(scale + IMAGE_PREVIEW_ZOOM_STEP)}
        >
          <PlusIcon className="size-3" />
          <span className="sr-only">Zoom in</span>
        </Button>
      </div>
    </div>
  )
}

function AssetPreviewContent(input: {
  asset: SessionDetailAsset
}) {
  const isImage = input.asset.asset_type === "photo"

  if (isImage && input.asset.signedUrl) {
    return (
      <ZoomableAssetImage src={input.asset.signedUrl} alt={input.asset.file_name} />
    )
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
          {isImage ? <ImageIcon className="size-6" /> : <FileIcon className="size-6" />}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium">{input.asset.file_name}</p>
          <p className="text-xs text-muted-foreground">
            {formatAssetSize(input.asset.size_bytes)} ·{" "}
            {formatAssetUploadedAt(input.asset.created_at)}
          </p>
          {input.asset.signedUrl ? null : (
            <p className="text-xs text-muted-foreground">Preview unavailable.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function AssetActions(input: {
  asset: SessionDetailAsset
  canManageSession: boolean
  onDeletingChange: (isDeleting: boolean) => void
  scope: NavigationScope
  sessionId: string
}) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const deleteLabel = input.asset.asset_type === "photo" ? "Delete image" : "Delete file"

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
      router.refresh()
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
          {input.asset.signedUrl ? (
            <>
              <DropdownMenuLinkItem
                href={input.asset.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="gap-2"
              >
                <ExternalLinkIcon className="size-4" />
                Open
              </DropdownMenuLinkItem>
              <DropdownMenuLinkItem
                href={input.asset.signedUrl}
                download={input.asset.file_name}
                className="gap-2"
              >
                <DownloadIcon className="size-4" />
                Download
              </DropdownMenuLinkItem>
            </>
          ) : (
            <DropdownMenuItem disabled>Unavailable</DropdownMenuItem>
          )}

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
        open={deleteDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isDeleting) {
            setDeleteDialogOpen(nextOpen)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
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
  scope: NavigationScope
  sessionId: string
}) {
  const isImage = input.asset.asset_type === "photo"
  const [isDeleting, setIsDeleting] = React.useState(false)

  return (
    <Dialog>
      <div
        className="group relative overflow-hidden rounded-lg border bg-card shadow-sm transition-colors hover:bg-muted/40"
        aria-busy={isDeleting}
      >
        {isDeleting ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/80 text-muted-foreground backdrop-blur-sm">
            <Loader2Icon className="size-6 animate-spin" />
            <span className="sr-only">Deleting file</span>
          </div>
        ) : null}
        <DialogTrigger
          render={
            <button
              type="button"
              disabled={isDeleting}
              className="block h-full w-full text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <div className="aspect-[4/3] overflow-hidden bg-muted">
            <AssetThumbnail asset={input.asset} />
          </div>
          <div className="space-y-1.5 p-2.5 sm:space-y-2 sm:p-3">
            <div className="flex min-w-0 items-center gap-1.5 pr-7 sm:gap-2 sm:pr-8">
              {isImage ? (
                <ImageIcon className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
              ) : (
                <FileIcon className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
              )}
              <p className="truncate text-xs font-medium sm:text-sm">{input.asset.file_name}</p>
            </div>
            <div className="space-y-0.5 text-[0.7rem] leading-tight text-muted-foreground sm:flex sm:items-center sm:justify-between sm:gap-3 sm:space-y-0 sm:text-xs">
              <p>{formatAssetSize(input.asset.size_bytes)}</p>
              <p className="truncate">{formatAssetUploadedAt(input.asset.created_at)}</p>
            </div>
          </div>
        </DialogTrigger>
        <AssetActions
          asset={input.asset}
          canManageSession={input.canManageSession}
          onDeletingChange={setIsDeleting}
          scope={input.scope}
          sessionId={input.sessionId}
        />
      </div>

      <DialogContent className="min-w-0 h-[calc(100dvh-0.75rem)] max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden p-3 sm:h-auto sm:max-h-[90dvh] sm:w-full sm:max-w-4xl sm:gap-4 sm:p-4">
        <DialogHeader className="min-w-0">
          <DialogTitle className="min-w-0 max-w-full truncate pr-10">
            {input.asset.file_name}
          </DialogTitle>
          <DialogDescription>
            {getAssetExtension(input.asset.file_name)} · {formatAssetSize(input.asset.size_bytes)} ·{" "}
            {formatAssetUploadedAt(input.asset.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto">
          <AssetPreviewContent asset={input.asset} />
        </div>

        {input.asset.signedUrl ? (
          <DialogFooter className="min-w-0 sm:justify-end">
            {input.asset.asset_type === "analytics_file" ? (
              <a
                href={input.asset.signedUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full sm:w-auto",
                )}
              >
                <ExternalLinkIcon className="size-4" />
                Open file
              </a>
            ) : null}
            <a
              href={input.asset.signedUrl}
              download={input.asset.file_name}
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "w-full sm:w-auto",
              )}
            >
              <DownloadIcon className="size-4" />
              Download
            </a>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
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
}) {
  const router = useRouter()
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
      const assetFile =
        input.assetType === "photo" ? await compressSessionPhotoFile(file) : file

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

      const result = await saveSessionAssetAction(formData)

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(input.assetType === "photo" ? "Image uploaded." : "File uploaded.")
      router.refresh()
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
