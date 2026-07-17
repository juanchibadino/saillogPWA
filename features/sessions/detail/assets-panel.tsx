"use client"

import Link from "next/link"
import * as React from "react"
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  ImageIcon,
  Loader2Icon,
  MoreVerticalIcon,
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
  DropdownMenuLinkItem,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteSessionAssetAction,
  saveSessionAssetAction,
} from "@/features/sessions/detail-actions"
import {
  buildAssetDownloadUrl,
  formatAssetSize,
  SessionAssetCard,
} from "@/features/assets/asset-browser-grid"
import { useIsMobile } from "@/hooks/use-mobile"
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
  id: string
  fileName: string
  statusLabel: string
}

type SelectedAssetUploadFile = {
  file: File
  id: string
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

type SessionAssetUploadBlockReason = "plan_limit_reached" | "payment_required" | null

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

function getUploadBlockedMessage(reason: SessionAssetUploadBlockReason): string {
  if (reason === "payment_required") {
    return "Your paid plan is inactive. Recover payment in Subscription to continue uploading files."
  }

  if (reason === "plan_limit_reached") {
    return "Free tier quota reached. Upgrade to Pro to continue."
  }

  return "Uploads are unavailable for this organization."
}

function buildSelectedAssetUploadFile(file: File, index: number): SelectedAssetUploadFile {
  return {
    file,
    id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
  }
}

function getAssetUploadPluralLabel(assetType: "photo" | "analytics_file", count: number): string {
  if (assetType === "photo") {
    return count === 1 ? "image" : "images"
  }

  return count === 1 ? "file" : "files"
}

function getAssetUploadSurfaceTitle(assetType: "photo" | "analytics_file"): string {
  return assetType === "photo" ? "Upload images" : "Upload files"
}

function getAssetUploadSelectLabel(assetType: "photo" | "analytics_file"): string {
  return assetType === "photo" ? "Choose images" : "Choose files"
}

function normalizeAssetUploadDescription(value: string): string {
  return value.trim()
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

function SessionAssetUploadSurface(input: {
  accept: string
  assetType: "photo" | "analytics_file"
  buttonLabel: string
  onAssetsChanged: () => Promise<void> | void
  onPendingUploadsChange: (pendingUploads: PendingAssetUpload[]) => void
  scope: NavigationScope
  sessionId: string
  tab: "images" | "analytics"
}) {
  const inputId = React.useId()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [description, setDescription] = React.useState("")
  const [selectedFiles, setSelectedFiles] = React.useState<SelectedAssetUploadFile[]>([])
  const [fileStatuses, setFileStatuses] = React.useState<Record<string, string>>({})
  const fileStatusesRef = React.useRef<Record<string, string>>({})
  const selectedFileCount = selectedFiles.length
  const surfaceTitle = getAssetUploadSurfaceTitle(input.assetType)
  const selectLabel = getAssetUploadSelectLabel(input.assetType)
  const uploadLabel =
    selectedFileCount > 0
      ? `Upload ${selectedFileCount} ${getAssetUploadPluralLabel(input.assetType, selectedFileCount)}`
      : "Upload"

  function resetUploadForm(): void {
    setSelectedFiles([])
    setDescription("")
    fileStatusesRef.current = {}
    setFileStatuses({})
    input.onPendingUploadsChange([])

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

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ""

    if (files.length === 0 || isUploading) {
      return
    }

    setSelectedFiles((currentFiles) => {
      const existingSignatures = new Set(
        currentFiles.map(
          (selectedFile) =>
            `${selectedFile.file.name}-${selectedFile.file.size}-${selectedFile.file.lastModified}`,
        ),
      )
      const nextFiles = files
        .map((file, index) => buildSelectedAssetUploadFile(file, currentFiles.length + index))
        .filter((selectedFile) => {
          const signature = `${selectedFile.file.name}-${selectedFile.file.size}-${selectedFile.file.lastModified}`

          if (existingSignatures.has(signature)) {
            return false
          }

          existingSignatures.add(signature)
          return true
        })

      return [...currentFiles, ...nextFiles]
    })
  }

  function removeSelectedFile(fileId: string): void {
    if (isUploading) {
      return
    }

    setSelectedFiles((currentFiles) => currentFiles.filter((selectedFile) => selectedFile.id !== fileId))
    setFileStatuses((currentStatuses) => {
      const nextStatuses = { ...currentStatuses }
      delete nextStatuses[fileId]
      fileStatusesRef.current = nextStatuses
      return nextStatuses
    })
  }

  function updateFileStatus(inputStatus: {
    fileId: string
    fileName?: string
    statusLabel: string
  }): void {
    const nextStatuses = {
      ...fileStatusesRef.current,
      [inputStatus.fileId]: inputStatus.statusLabel,
    }

    fileStatusesRef.current = nextStatuses
    setFileStatuses(nextStatuses)
    input.onPendingUploadsChange(
      selectedFiles.map((selectedFile) => ({
        id: selectedFile.id,
        fileName:
          selectedFile.id === inputStatus.fileId
            ? inputStatus.fileName ?? selectedFile.file.name
            : selectedFile.file.name,
        statusLabel: nextStatuses[selectedFile.id] ?? "Queued",
      })),
    )
  }

  async function uploadSelectedFiles(): Promise<void> {
    if (selectedFiles.length === 0) {
      toast.error(
        input.assetType === "photo" ? "Choose at least one image." : "Choose at least one file.",
      )
      return
    }

    const normalizedDescription = normalizeAssetUploadDescription(description)
    const initialStatuses = Object.fromEntries(
      selectedFiles.map((selectedFile) => [selectedFile.id, "Queued"]),
    )
    let uploadedCount = 0
    const failedFiles: SelectedAssetUploadFile[] = []

    setIsUploading(true)
    fileStatusesRef.current = initialStatuses
    setFileStatuses(initialStatuses)
    input.onPendingUploadsChange(
      selectedFiles.map((selectedFile) => ({
        id: selectedFile.id,
        fileName: selectedFile.file.name,
        statusLabel: "Queued",
      })),
    )

    for (const selectedFile of selectedFiles) {
      try {
        updateFileStatus({
          fileId: selectedFile.id,
          statusLabel: input.assetType === "photo" ? "Compressing..." : "Uploading...",
        })

        const compressedPhotoFiles =
          input.assetType === "photo" ? await compressSessionPhotoFiles(selectedFile.file) : null
        const assetFile = compressedPhotoFiles?.displayFile ?? selectedFile.file

        updateFileStatus({
          fileId: selectedFile.id,
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
        if (normalizedDescription.length > 0) {
          formData.set("description", normalizedDescription)
        }
        if (compressedPhotoFiles) {
          formData.set("thumbnailFile", compressedPhotoFiles.thumbnailFile)
        }

        const result = await saveSessionAssetAction(formData)

        if (!result.ok) {
          failedFiles.push(selectedFile)
          updateFileStatus({
            fileId: selectedFile.id,
            statusLabel: "Failed",
          })
          toast.error(`${selectedFile.file.name}: ${result.message}`)
          continue
        }

        uploadedCount += 1
        updateFileStatus({
          fileId: selectedFile.id,
          statusLabel: "Uploaded",
        })
      } catch (error) {
        failedFiles.push(selectedFile)
        updateFileStatus({
          fileId: selectedFile.id,
          statusLabel: "Failed",
        })
        toast.error(
          `${selectedFile.file.name}: ${
            error instanceof Error ? error.message : "Could not upload this file."
          }`,
        )
      }
    }

    if (uploadedCount > 0) {
      toast.success(
        `${uploadedCount} ${getAssetUploadPluralLabel(input.assetType, uploadedCount)} uploaded.`,
      )
      try {
        await input.onAssetsChanged()
      } catch {
        toast.error("Assets uploaded, but the list could not refresh.")
      }
    }

    input.onPendingUploadsChange([])
    setIsUploading(false)

    if (failedFiles.length === 0) {
      resetUploadForm()
      setIsOpen(false)
      return
    }

    setSelectedFiles(failedFiles)
    fileStatusesRef.current = Object.fromEntries(
      failedFiles.map((failedFile) => [failedFile.id, "Failed"]),
    )
    setFileStatuses(fileStatusesRef.current)
  }

  const content = (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          multiple
          accept={input.accept}
          disabled={isUploading}
          onChange={handleFileInputChange}
          className="hidden"
          aria-label={selectLabel}
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
            {selectLabel}
          </Button>
          <p className="text-xs text-muted-foreground">
            {selectedFileCount === 0
              ? "No assets selected."
              : `${selectedFileCount} ${getAssetUploadPluralLabel(
                  input.assetType,
                  selectedFileCount,
                )} selected.`}
          </p>
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
            placeholder="Add one description for all selected assets."
            className={isMobile ? "min-h-28 resize-none text-base" : "min-h-24 resize-none"}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Selected assets</p>
          {selectedFiles.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              Choose one or more assets before uploading.
            </div>
          ) : (
            <div className="space-y-2">
              {selectedFiles.map((selectedFile) => {
                const isImage = input.assetType === "photo"
                const status = fileStatuses[selectedFile.id] ?? "Ready"

                return (
                  <div
                    key={selectedFile.id}
                    className="flex min-w-0 items-center gap-3 rounded-lg border bg-card p-2.5"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {isImage ? <ImageIcon className="size-4" /> : <FileIcon className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{selectedFile.file.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatAssetSize(selectedFile.file.size)} · {status}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size={isMobile ? "icon" : "icon-sm"}
                      className={isMobile ? "h-11 w-11" : undefined}
                      disabled={isUploading}
                      onClick={() => removeSelectedFile(selectedFile.id)}
                    >
                      <XIcon className="size-4" />
                      <span className="sr-only">Remove {selectedFile.file.name}</span>
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {isMobile ? (
        <DrawerFooter className="shrink-0 border-t">
          <Button
            type="button"
            className="h-11 w-full"
            disabled={isUploading || selectedFiles.length === 0}
            onClick={() => {
              void uploadSelectedFiles()
            }}
          >
            {isUploading ? <Loader2Icon className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
            {uploadLabel}
          </Button>
        </DrawerFooter>
      ) : (
        <SheetFooter className="shrink-0 border-t sm:justify-end">
          <Button
            type="button"
            size="sm"
            disabled={isUploading || selectedFiles.length === 0}
            onClick={() => {
              void uploadSelectedFiles()
            }}
          >
            {isUploading ? <Loader2Icon className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
            {uploadLabel}
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
            size="default"
            disabled={isUploading}
            className="h-11 w-full sm:h-7 sm:w-auto"
          >
            <UploadIcon className="size-4" />
            {input.buttonLabel}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="flex max-h-[85dvh] min-h-0 flex-col overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b px-4 py-3">
            <DrawerTitle>{surfaceTitle}</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<Button type="button" variant="default" size="sm" disabled={isUploading} />}>
        <UploadIcon className="size-4" />
        {input.buttonLabel}
      </SheetTrigger>
      <SheetContent side="right" className="h-full overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>{surfaceTitle}</SheetTitle>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  )
}

function AssetGrid(input: {
  assets: SessionDetailAsset[]
  canManageSession: boolean
  emptyMessage: string
  onAssetsChanged: () => Promise<void> | void
  pendingUploads: PendingAssetUpload[]
  scope: NavigationScope
  sessionId: string
}) {
  if (input.assets.length === 0 && input.pendingUploads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
        {input.emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {input.pendingUploads.map((pendingUpload) => (
        <PendingAssetCard key={pendingUpload.id} pendingUpload={pendingUpload} />
      ))}
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
  canUploadAssets: boolean
  assetUploadBlockReason?: SessionAssetUploadBlockReason
  isLoadingMore?: boolean
  onLoadMore?: () => void
  onAssetsChanged: () => Promise<void> | void
}) {
  const [pendingUploads, setPendingUploads] = React.useState<PendingAssetUpload[]>([])
  const description = input.description?.trim()
  const hasMoreAssets = input.assets.length < input.assetTotalCount
  const canUploadAssets = input.canManageSession && input.canUploadAssets
  const subscriptionHref = buildSubscriptionHref(input.scope)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{input.title}</h3>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {canUploadAssets ? (
          <SessionAssetUploadSurface
            accept={input.accept}
            assetType={input.assetType}
            buttonLabel={input.buttonLabel}
            onAssetsChanged={input.onAssetsChanged}
            onPendingUploadsChange={setPendingUploads}
            scope={input.scope}
            sessionId={input.sessionId}
            tab={input.tab}
          />
        ) : null}
      </div>

      {input.canManageSession && !input.canUploadAssets ? (
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

      <AssetGrid
        assets={input.assets}
        canManageSession={input.canManageSession}
        emptyMessage={input.emptyMessage}
        onAssetsChanged={input.onAssetsChanged}
        pendingUploads={pendingUploads}
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
