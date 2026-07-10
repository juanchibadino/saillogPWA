"use client"

import * as React from "react"
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  ImageIcon,
  Loader2Icon,
  MinusIcon,
  MoreVerticalIcon,
  PlusIcon,
} from "lucide-react"

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
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SessionDetailAsset } from "@/features/sessions/detail-types"
import { cn } from "@/lib/utils"

type ImagePreviewPointerPosition = {
  x: number
  y: number
}

const MIN_IMAGE_PREVIEW_ZOOM = 1
const MAX_IMAGE_PREVIEW_ZOOM = 3
const IMAGE_PREVIEW_ZOOM_STEP = 0.35
const IMAGE_PREVIEW_PINCH_SENSITIVITY = 0.5

export function formatAssetSize(sizeBytes: number | null): string {
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

export function formatAssetUploadedAt(value: string): string {
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

export function buildAssetDownloadUrl(contentUrl: string): string {
  const separator = contentUrl.includes("?") ? "&" : "?"
  return `${contentUrl}${separator}download=1`
}

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

function getAssetExtension(fileName: string): string {
  const parts = fileName.split(".")
  const extension = parts.length > 1 ? parts.at(-1) : null
  return extension ? extension.slice(0, 5).toUpperCase() : "FILE"
}

function AssetThumbnail(input: {
  asset: SessionDetailAsset
}) {
  const isImage = input.asset.asset_type === "photo"
  const thumbnailUrl = input.asset.thumbnailSignedUrl ?? input.asset.signedUrl
  const [imageStatus, setImageStatus] = React.useState<"loading" | "loaded" | "error">(
    isImage && thumbnailUrl ? "loading" : "error",
  )

  React.useEffect(() => {
    setImageStatus(isImage && thumbnailUrl ? "loading" : "error")
  }, [thumbnailUrl, isImage])

  if (isImage && thumbnailUrl && imageStatus !== "error") {
    return (
      <div className="relative h-full w-full">
        {imageStatus === "loading" ? <AssetThumbnailSpinner /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl}
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
  alt: string
  src: string
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
    return <ZoomableAssetImage src={input.asset.signedUrl} alt={input.asset.file_name} />
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

export function SessionAssetOpenDownloadActions(input: {
  asset: SessionDetailAsset
}) {
  const downloadUrl = buildAssetDownloadUrl(input.asset.contentUrl)

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SessionAssetCard(input: {
  asset: SessionDetailAsset
  busyLabel?: string
  isBusy?: boolean
  overlayActions?: React.ReactNode
}) {
  const isImage = input.asset.asset_type === "photo"
  const downloadUrl = buildAssetDownloadUrl(input.asset.contentUrl)
  const busyLabel = input.busyLabel ?? "Loading file"

  return (
    <Dialog>
      <div
        className="group relative overflow-hidden rounded-lg border bg-card shadow-sm transition-colors hover:bg-muted/40"
        aria-busy={input.isBusy}
      >
        {input.isBusy ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/80 text-muted-foreground backdrop-blur-sm">
            <Loader2Icon className="size-6 animate-spin" />
            <span className="sr-only">{busyLabel}</span>
          </div>
        ) : null}
        <DialogTrigger
          render={
            <button
              type="button"
              disabled={input.isBusy}
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
        {input.overlayActions}
      </div>

      <DialogContent className="grid h-[calc(100dvh-0.75rem)] max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden p-3 sm:h-auto sm:max-h-[90dvh] sm:w-full sm:max-w-4xl sm:gap-4 sm:p-4">
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

        <DialogFooter className="min-w-0 sm:justify-end">
          {input.asset.asset_type === "analytics_file" ? (
            <a
              href={input.asset.contentUrl}
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
            href={downloadUrl}
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
      </DialogContent>
    </Dialog>
  )
}

export function SessionAssetBrowseGrid(input: {
  assets: SessionDetailAsset[]
  emptyMessage: string
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
        <SessionAssetCard
          key={asset.id}
          asset={asset}
          overlayActions={<SessionAssetOpenDownloadActions asset={asset} />}
        />
      ))}
    </div>
  )
}
