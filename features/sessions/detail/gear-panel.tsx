"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CameraIcon, Loader2Icon, SearchIcon } from "lucide-react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  saveSessionGearUsageAction,
  updateSessionGearUsageAction,
} from "@/features/sessions/actions"
import type {
  SessionDetailCatalogPage,
  SessionDetailGearCatalogData,
  SessionDetailGearItem,
  SessionDetailGearTypeFilter,
} from "@/features/sessions/detail-types"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type SessionGearCatalogErrorPayload = {
  detail?: unknown
  error?: unknown
}

type SessionGearCatalogResponse = {
  catalog: "gear"
  data: SessionDetailGearCatalogData
}

type SessionGearBarcodeResponse = {
  catalog: "gearBarcode"
  data: {
    gearItem: SessionDetailGearItem | null
  }
}

function mergeGearItemsById(
  currentItems: SessionDetailGearItem[],
  nextItems: SessionDetailGearItem[],
): SessionDetailGearItem[] {
  const itemsById = new Map<string, SessionDetailGearItem>()

  for (const item of [...currentItems, ...nextItems]) {
    itemsById.set(item.id, item)
  }

  return [...itemsById.values()].sort((left, right) => left.name.localeCompare(right.name))
}

function buildSessionGearCatalogUrl(input: {
  barcode?: string
  gearType?: SessionDetailGearTypeFilter
  linkedGearItemIds?: string[]
  offset?: number
  scope: NavigationScope
  search?: string
  sessionId: string
}): string {
  const params = new URLSearchParams()
  params.set("catalog", input.barcode ? "gearBarcode" : "gear")
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  if (input.barcode) {
    params.set("barcode", input.barcode)
  } else {
    params.set("gearType", input.gearType ?? "all")
    params.set("offset", String(input.offset ?? 0))
    params.set("search", input.search ?? "")

    for (const linkedGearItemId of input.linkedGearItemIds ?? []) {
      params.append("linkedGearItemId", linkedGearItemId)
    }
  }

  return `/api/team-sessions/${encodeURIComponent(input.sessionId)}/catalog?${params.toString()}`
}

async function resolveSessionGearCatalogErrorMessage(response: Response): Promise<string> {
  let payload: SessionGearCatalogErrorPayload | null = null

  try {
    payload = (await response.json()) as SessionGearCatalogErrorPayload
  } catch {
    payload = null
  }

  const errorCode = typeof payload?.error === "string" ? payload.error : null

  if (response.status === 401 || errorCode === "unauthorized") {
    return "Your session expired. Sign in again, then retry gear search."
  }

  if (response.status === 403 || errorCode === "scope_required") {
    return "This gear search needs an active team scope."
  }

  if (response.status === 404 || errorCode === "session_not_found") {
    return "This session is unavailable in the active team scope."
  }

  return "Could not load gear."
}

async function fetchSessionGearCatalog(input: {
  gearType: SessionDetailGearTypeFilter
  linkedGearItemIds: string[]
  offset: number
  scope: NavigationScope
  search: string
  sessionId: string
}): Promise<SessionDetailGearCatalogData> {
  const response = await fetch(buildSessionGearCatalogUrl(input), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(await resolveSessionGearCatalogErrorMessage(response))
  }

  const payload = (await response.json()) as SessionGearCatalogResponse
  return payload.data
}

async function fetchSessionGearByBarcode(input: {
  barcode: string
  scope: NavigationScope
  sessionId: string
}): Promise<SessionDetailGearItem | null> {
  const response = await fetch(buildSessionGearCatalogUrl(input), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(await resolveSessionGearCatalogErrorMessage(response))
  }

  const payload = (await response.json()) as SessionGearBarcodeResponse
  return payload.data.gearItem
}

function formatGearTypeLabel(value: SessionDetailGearItem["gear_type"]): string {
  if (value === "sails") {
    return "Sails"
  }

  if (value === "spars_and_foils") {
    return "Spars & Foils"
  }

  if (value === "running_rigging") {
    return "Running Rigging"
  }

  return "Hardware & Fittings"
}

const GEAR_TYPE_TAB_ORDER: SessionDetailGearItem["gear_type"][] = [
  "sails",
  "spars_and_foils",
  "running_rigging",
  "hardware_and_fittings",
]
type SessionGearSelectorTab = "all" | "linked" | SessionDetailGearItem["gear_type"]

type DetectedBarcodeLike = {
  rawValue?: string
}

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource | Blob | ImageData): Promise<DetectedBarcodeLike[]>
}

type BarcodeDetectorConstructorLike = {
  new (options?: { formats?: readonly string[] }): BarcodeDetectorLike
}

const SUPPORTED_BARCODE_FORMATS = [
  "aztec",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "data_matrix",
  "ean_13",
  "ean_8",
  "itf",
  "pdf417",
  "qr_code",
  "upc_a",
  "upc_e",
] as const

function getBarcodeDetectorConstructor(): BarcodeDetectorConstructorLike | null {
  if (typeof window === "undefined") {
    return null
  }

  const candidate: unknown = Reflect.get(window, "BarcodeDetector")

  if (typeof candidate !== "function") {
    return null
  }

  return candidate as BarcodeDetectorConstructorLike
}

function formatGearStatusLabel(value: SessionDetailGearItem["status"]): string {
  if (value === "active_regatta") {
    return "Active Regatta"
  }

  if (value === "active_training") {
    return "Active Training"
  }

  if (value === "retired_spare") {
    return "Retired/Spare"
  }

  return "On Repair"
}

function formatGearIdentifiers(input: {
  serialNumber: string | null
  barcode: string | null
}): string | null {
  const parts: string[] = []

  if (input.serialNumber && input.serialNumber.trim().length > 0) {
    parts.push(`SN ${input.serialNumber.trim()}`)
  }

  if (input.barcode && input.barcode.trim().length > 0) {
    parts.push(`BC ${input.barcode.trim()}`)
  }

  if (parts.length === 0) {
    return null
  }

  return parts.join(" · ")
}

function normalizeBarcodeValue(value: string): string {
  return value.trim()
}

function SessionGearBarcodeScannerDialog({
  buttonClassName,
  onDetected,
  disabled = false,
}: {
  buttonClassName?: string
  onDetected: (value: string) => void
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isStarting, setIsStarting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const detectorRef = React.useRef<BarcodeDetectorLike | null>(null)
  const frameRequestRef = React.useRef<number | null>(null)
  const isClosedRef = React.useRef(false)
  const isDetectingRef = React.useRef(false)
  const portalContainerRef = React.useRef<HTMLSpanElement | null>(null)

  const stopScanner = React.useCallback(() => {
    if (frameRequestRef.current !== null) {
      window.cancelAnimationFrame(frameRequestRef.current)
      frameRequestRef.current = null
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
    }

    streamRef.current = null
    detectorRef.current = null
    isDetectingRef.current = false

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const scheduleDetection = React.useCallback(() => {
    if (isClosedRef.current) {
      return
    }

    frameRequestRef.current = window.requestAnimationFrame(async () => {
      if (isClosedRef.current || isDetectingRef.current) {
        scheduleDetection()
        return
      }

      const detector = detectorRef.current
      const video = videoRef.current

      if (!detector || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        scheduleDetection()
        return
      }

      isDetectingRef.current = true

      try {
        const matches = await detector.detect(video)
        const firstMatch = matches.find(
          (match) =>
            typeof match.rawValue === "string" &&
            normalizeBarcodeValue(match.rawValue).length > 0,
        )

        if (firstMatch?.rawValue) {
          onDetected(normalizeBarcodeValue(firstMatch.rawValue))
          setIsOpen(false)
          return
        }
      } catch {
        setErrorMessage("Could not read barcode from camera frames.")
      } finally {
        isDetectingRef.current = false
      }

      scheduleDetection()
    })
  }, [onDetected])

  React.useEffect(() => {
    if (!isOpen) {
      isClosedRef.current = true
      stopScanner()
      setIsStarting(false)
      return
    }

    isClosedRef.current = false
    setIsStarting(true)
    setErrorMessage(null)

    const barcodeDetectorConstructor = getBarcodeDetectorConstructor()

    if (!barcodeDetectorConstructor) {
      setErrorMessage(
        "Barcode scanning is not supported in this browser. Enter barcode manually.",
      )
      setIsStarting(false)
      return
    }

    const detectorCtor = barcodeDetectorConstructor

    async function startScanner() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
          },
        })

        if (isClosedRef.current) {
          for (const track of stream.getTracks()) {
            track.stop()
          }

          return
        }

        streamRef.current = stream
        detectorRef.current = new detectorCtor({
          formats: SUPPORTED_BARCODE_FORMATS,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setIsStarting(false)
        scheduleDetection()
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Camera access failed. Check browser permissions and try again."

        setErrorMessage(message)
        setIsStarting(false)
        stopScanner()
      }
    }

    void startScanner()

    return () => {
      isClosedRef.current = true
      stopScanner()
    }
  }, [isOpen, scheduleDetection, stopScanner])

  return (
    <Dialog modal={false} open={isOpen} onOpenChange={setIsOpen} disablePointerDismissal>
      <span ref={portalContainerRef} className="contents">
        <Button
          type="button"
          variant="outline"
          className={buttonClassName}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
        >
          <CameraIcon className="size-4" />
          Scan
        </Button>
      </span>
      <DialogContent
        className="z-[70] sm:max-w-lg"
        overlayClassName="z-[60]"
        overlayStyle={{ zIndex: 60 }}
        portalContainer={portalContainerRef.current ?? undefined}
        style={{ zIndex: 70 }}
      >
        <DialogHeader>
          <DialogTitle>Scan</DialogTitle>
          <DialogDescription>
            Point your camera at a barcode to auto-link gear.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border bg-black/95">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full object-cover"
            />
          </div>

          {isStarting ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Starting camera...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="text-sm text-rose-700">{errorMessage}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Keep the barcode centered for faster detection.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SessionGearDialogFields({
  children,
  className,
  isSaving,
}: {
  children: React.ReactNode
  className?: string
  isSaving: boolean
}) {
  const { pending } = useFormStatus()

  return (
    <fieldset disabled={pending || isSaving} className={cn("space-y-3", className)}>
      {children}
    </fieldset>
  )
}

function SessionGearSubmitButton({
  className,
  isSaving,
}: {
  className?: string
  isSaving: boolean
}) {
  const { pending } = useFormStatus()
  const isPending = pending || isSaving

  return (
    <Button type="submit" disabled={isPending} className={className}>
      {isPending ? (
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

function SessionGearDialogFooter({
  isSaving,
  onScanned,
  surface,
}: {
  isSaving: boolean
  onScanned: (barcodeValue: string) => void
  surface: "drawer" | "sheet"
}) {
  const { pending } = useFormStatus()
  const isPending = pending || isSaving
  const drawerButtonClassName = surface === "drawer" ? "h-11 w-full" : undefined

  const content = (
    <>
      <div className={surface === "sheet" ? "sm:mr-auto" : undefined}>
        <SessionGearBarcodeScannerDialog
          buttonClassName={drawerButtonClassName}
          disabled={isPending}
          onDetected={onScanned}
        />
      </div>
      <div className={surface === "sheet" ? "sm:ml-auto" : undefined}>
        <SessionGearSubmitButton
          className={drawerButtonClassName}
          isSaving={isSaving}
        />
      </div>
    </>
  )

  if (surface === "drawer") {
    return <DrawerFooter className="shrink-0 border-t">{content}</DrawerFooter>
  }

  return (
    <SheetFooter className="shrink-0 border-t sm:flex-row sm:justify-between">
      {content}
    </SheetFooter>
  )
}

function SessionGearLinkDialog(input: {
  gearCatalogPage: SessionDetailCatalogPage
  gearType: SessionDetailGearTypeFilter
  sessionId: string
  scope: NavigationScope
  gearItems: SessionDetailGearItem[]
  linkedGearItemIds: string[]
  onCatalogLoad: (input: {
    gearCatalogPage: SessionDetailCatalogPage
    gearItems: SessionDetailGearItem[]
    gearType: SessionDetailGearTypeFilter
    mode: "append" | "replace"
  }) => void
  onSaved: (linkedGearItemIds: string[]) => void
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectorTab, setSelectorTab] = React.useState<SessionGearSelectorTab>("all")
  const [gearSearch, setGearSearch] = React.useState("")
  const [catalogGearItems, setCatalogGearItems] = React.useState<SessionDetailGearItem[]>(
    input.gearItems,
  )
  const [catalogGearPage, setCatalogGearPage] = React.useState<SessionDetailCatalogPage>(
    input.gearCatalogPage,
  )
  const [catalogGearType, setCatalogGearType] =
    React.useState<SessionDetailGearTypeFilter>(input.gearType)
  const [isGearCatalogLoading, setIsGearCatalogLoading] = React.useState(false)
  const [gearCatalogError, setGearCatalogError] = React.useState<string | null>(null)
  const [selectedGearItemIds, setSelectedGearItemIds] = React.useState<string[]>(() =>
    [...new Set(input.linkedGearItemIds)],
  )
  const [isSavingGear, setIsSavingGear] = React.useState(false)
  const [scanFeedbackMessage, setScanFeedbackMessage] = React.useState<string | null>(null)
  const [scanFeedbackType, setScanFeedbackType] = React.useState<"success" | "error">("success")
  const gearCatalogRequestVersionRef = React.useRef(0)
  const wasOpenRef = React.useRef(false)
  const router = useRouter()
  const isMobile = useIsMobile()
  const availableGearTypes = GEAR_TYPE_TAB_ORDER

  React.useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false
      return
    }

    if (wasOpenRef.current) {
      return
    }

    wasOpenRef.current = true
    setSelectedGearItemIds([...new Set(input.linkedGearItemIds)])
    setSelectorTab("all")
    setGearSearch("")
    setCatalogGearItems(input.gearItems)
    setCatalogGearPage(input.gearCatalogPage)
    setCatalogGearType(input.gearType)
    setGearCatalogError(null)
    setScanFeedbackMessage(null)
  }, [
    isOpen,
    input.gearCatalogPage,
    input.gearItems,
    input.gearType,
    input.linkedGearItemIds,
  ])

  const loadGearCatalog = React.useCallback(
    async (request: {
      gearType: SessionDetailGearTypeFilter
      mode: "append" | "replace"
      offset: number
      search: string
    }) => {
      const requestVersion = gearCatalogRequestVersionRef.current + 1
      gearCatalogRequestVersionRef.current = requestVersion
      setIsGearCatalogLoading(true)
      setGearCatalogError(null)

      try {
        const result = await fetchSessionGearCatalog({
          gearType: request.gearType,
          linkedGearItemIds: selectedGearItemIds,
          offset: request.offset,
          scope: input.scope,
          search: request.search,
          sessionId: input.sessionId,
        })

        if (requestVersion !== gearCatalogRequestVersionRef.current) {
          return
        }

        setCatalogGearItems((currentItems) =>
          request.mode === "append"
            ? mergeGearItemsById(currentItems, result.gearItems)
            : result.gearItems,
        )
        setCatalogGearPage(result.gearCatalogPage)
        setCatalogGearType(result.gearType)
        input.onCatalogLoad({
          gearCatalogPage: result.gearCatalogPage,
          gearItems: result.gearItems,
          gearType: result.gearType,
          mode: request.mode,
        })
      } catch (error) {
        if (requestVersion !== gearCatalogRequestVersionRef.current) {
          return
        }

        setGearCatalogError(error instanceof Error ? error.message : "Could not load gear.")
      } finally {
        if (requestVersion === gearCatalogRequestVersionRef.current) {
          setIsGearCatalogLoading(false)
        }
      }
    },
    [input, selectedGearItemIds],
  )

  React.useEffect(() => {
    if (!isOpen || selectorTab === "linked") {
      return
    }

    const gearType =
      selectorTab === "all" ? "all" : (selectorTab as SessionDetailGearTypeFilter)
    const normalizedSearch = gearSearch.trim()

    if (
      catalogGearType === gearType &&
      normalizedSearch === catalogGearPage.search &&
      catalogGearPage.offset === 0
    ) {
      return
    }

    const searchTimer = window.setTimeout(() => {
      void loadGearCatalog({
        gearType,
        mode: "replace",
        offset: 0,
        search: normalizedSearch,
      })
    }, 250)

    return () => window.clearTimeout(searchTimer)
  }, [
    catalogGearPage.offset,
    catalogGearPage.search,
    catalogGearType,
    gearSearch,
    isOpen,
    loadGearCatalog,
    selectorTab,
  ])

  function handleCheckedChange(gearItemId: string, checked: boolean): void {
    setScanFeedbackMessage(null)

    setSelectedGearItemIds((currentIds) => {
      if (checked) {
        if (currentIds.includes(gearItemId)) {
          return currentIds
        }

        return [...currentIds, gearItemId]
      }

      return currentIds.filter((id) => id !== gearItemId)
    })
  }

  async function handleBarcodeScanned(barcodeValue: string): Promise<void> {
    const normalizedBarcode = normalizeBarcodeValue(barcodeValue).toLowerCase()

    if (normalizedBarcode.length === 0) {
      setScanFeedbackType("error")
      setScanFeedbackMessage("Barcode is not registered")
      return
    }

    try {
      const matchedGearItem = await fetchSessionGearByBarcode({
        barcode: normalizedBarcode,
        scope: input.scope,
        sessionId: input.sessionId,
      })

      if (!matchedGearItem) {
        setScanFeedbackType("error")
        setScanFeedbackMessage("Barcode is not registered")
        return
      }

      setCatalogGearItems((currentItems) => mergeGearItemsById(currentItems, [matchedGearItem]))
      input.onCatalogLoad({
        gearCatalogPage: catalogGearPage,
        gearItems: [matchedGearItem],
        gearType: catalogGearType,
        mode: "append",
      })
      setSelectedGearItemIds((currentIds) =>
        currentIds.includes(matchedGearItem.id)
          ? currentIds
          : [...currentIds, matchedGearItem.id],
      )
      setSelectorTab("linked")
      setScanFeedbackType("success")
      setScanFeedbackMessage(`Linked: ${matchedGearItem.name}`)
    } catch {
      setScanFeedbackType("error")
      setScanFeedbackMessage("Could not check this barcode.")
    }
  }

  async function handleGearSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    if (isSavingGear) {
      return
    }

    const formData = new FormData(event.currentTarget)
    const submittedGearItemIds = selectedGearItemIds
    const toastId = `session-gear-save:${input.sessionId}`

    setIsSavingGear(true)

    try {
      const result = await saveSessionGearUsageAction(formData)

      if (!result.ok) {
        toast.error(result.message, { id: toastId })
        return
      }

      input.onSaved(submittedGearItemIds)
      setIsOpen(false)
      toast.success("Session gear updated successfully.", { id: toastId })
      router.refresh()
    } catch {
      toast.error("Could not update session gear. Confirm permissions and try again.", {
        id: toastId,
      })
    } finally {
      setIsSavingGear(false)
    }
  }

  const selectedGearItemIdSet = new Set(selectedGearItemIds)
  const cachedGearItems = mergeGearItemsById(input.gearItems, catalogGearItems)
  const linkedGearItems = cachedGearItems.filter((gearItem) =>
    selectedGearItemIdSet.has(gearItem.id),
  )
  const activeSelectorTab: SessionGearSelectorTab =
    selectorTab === "all" ||
    selectorTab === "linked" ||
    availableGearTypes.includes(selectorTab as SessionDetailGearItem["gear_type"])
      ? selectorTab
      : "all"
  const visibleGearItems =
    activeSelectorTab === "linked"
      ? linkedGearItems
      : activeSelectorTab === "all"
        ? catalogGearItems
        : catalogGearItems.filter((gearItem) => gearItem.gear_type === activeSelectorTab)
  const activeSelectorLabel =
    activeSelectorTab === "all"
      ? "All Gear"
      : activeSelectorTab === "linked"
        ? `Linked (${linkedGearItems.length})`
        : formatGearTypeLabel(activeSelectorTab)

  function renderGearCard(gearItem: SessionDetailGearItem) {
    const isSelected = selectedGearItemIdSet.has(gearItem.id)
    const primaryMeta = `${formatGearTypeLabel(gearItem.gear_type)} · ${formatGearStatusLabel(gearItem.status)}`
    const identifiers = formatGearIdentifiers({
      serialNumber: gearItem.serial_number,
      barcode: gearItem.barcode,
    })

    return (
      <button
        key={gearItem.id}
        type="button"
        aria-pressed={isSelected}
        onClick={() => handleCheckedChange(gearItem.id, !isSelected)}
        className={`w-full rounded-md border p-3 text-left transition-colors ${
          isSelected
            ? "border-emerald-200/70 bg-emerald-50/30 dark:border-emerald-700/55 dark:bg-emerald-950/20"
            : "border-border bg-background dark:bg-muted/70"
        }`}
      >
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <p className="truncate text-sm font-medium">{gearItem.name}</p>
            <p className="shrink-0 text-right text-xs text-muted-foreground">{primaryMeta}</p>
          </div>
          {identifiers ? <p className="text-xs text-muted-foreground">{identifiers}</p> : null}
        </div>
      </button>
    )
  }

  function renderGearResults() {
    if (activeSelectorTab === "linked") {
      return linkedGearItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No gear currently linked in this selection.
        </p>
      ) : (
        <div className="space-y-3 pr-1">
          {linkedGearItems.map((gearItem) => renderGearCard(gearItem))}
        </div>
      )
    }

    if (gearCatalogError) {
      return <p className="text-sm text-muted-foreground">{gearCatalogError}</p>
    }

    if (isGearCatalogLoading && visibleGearItems.length === 0) {
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading gear...
        </p>
      )
    }

    if (visibleGearItems.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          {gearSearch.trim().length > 0
            ? "No gear matches this search."
            : activeSelectorTab === "all"
              ? "No gear items available."
              : `No ${formatGearTypeLabel(activeSelectorTab).toLowerCase()} gear available.`}
        </p>
      )
    }

    return (
      <div className="space-y-3 pr-1">
        {visibleGearItems.map((gearItem) => renderGearCard(gearItem))}
      </div>
    )
  }

  const gearForm = (
    <form
      action={updateSessionGearUsageAction}
      onSubmit={handleGearSubmit}
      className="flex min-h-0 flex-1 flex-col"
    >
      <input type="hidden" name="sessionId" value={input.sessionId} />
      <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
      {input.scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
      ) : null}
      <input type="hidden" name="scopeTab" value="gear" />

      {selectedGearItemIds.map((gearItemId) => (
        <input
          key={`selected-gear-${gearItemId}`}
          type="hidden"
          name="gearItemIds"
          value={gearItemId}
        />
      ))}

      <SessionGearDialogFields
        className="min-h-0 flex-1 overflow-y-auto px-4"
        isSaving={isSavingGear}
      >
        {catalogGearPage.totalCount === 0 && gearSearch.trim().length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No gear items exist for this team yet. Add items in Team Gear first.
          </p>
        ) : (
          <div className="min-h-0 space-y-3">
            <Select
              value={activeSelectorTab}
              onValueChange={(value) => setSelectorTab(value as SessionGearSelectorTab)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{activeSelectorLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Gear</SelectItem>
                <SelectItem value="linked">Linked ({linkedGearItems.length})</SelectItem>
                {availableGearTypes.map((gearType) => (
                  <SelectItem key={gearType} value={gearType}>
                    {formatGearTypeLabel(gearType)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeSelectorTab !== "linked" ? (
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={gearSearch}
                  onChange={(event) => setGearSearch(event.target.value)}
                  placeholder="Search gear"
                  className="pl-9"
                  aria-label="Search gear"
                />
              </div>
            ) : null}

            <div className="space-y-3">{renderGearResults()}</div>

            {activeSelectorTab !== "linked" && catalogGearPage.nextOffset !== null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isGearCatalogLoading}
                onClick={() =>
                  void loadGearCatalog({
                    gearType:
                      activeSelectorTab === "all"
                        ? "all"
                        : (activeSelectorTab as SessionDetailGearTypeFilter),
                    mode: "append",
                    offset: catalogGearPage.nextOffset ?? 0,
                    search: gearSearch.trim(),
                  })
                }
              >
                {isGearCatalogLoading ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            ) : null}
          </div>
        )}
      </SessionGearDialogFields>

      {scanFeedbackMessage ? (
        <p
          className={
            scanFeedbackType === "error"
              ? "shrink-0 px-4 pt-3 text-sm text-rose-700"
              : "shrink-0 px-4 pt-3 text-sm text-emerald-700"
          }
        >
          {scanFeedbackMessage}
        </p>
      ) : null}

      <SessionGearDialogFooter
        isSaving={isSavingGear}
        onScanned={handleBarcodeScanned}
        surface={isMobile ? "drawer" : "sheet"}
      />
    </form>
  )

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button type="button" variant="outline" size="default" className="h-9 px-3">
            Link Gear
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Link gear to session</DrawerTitle>
          </DrawerHeader>
          {gearForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Link Gear
      </SheetTrigger>
      <SheetContent side="right" className="h-full overflow-hidden sm:max-w-2xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>Link gear to session</SheetTitle>
        </SheetHeader>
        {gearForm}
      </SheetContent>
    </Sheet>
  )
}

function SessionGearPanel(input: {
  gearItems: SessionDetailGearItem[]
  linkedGearItemIds: string[]
}) {
  const linkedIds = new Set(input.linkedGearItemIds)
  const linkedItems = input.gearItems.filter((gearItem) => linkedIds.has(gearItem.id))

  if (linkedItems.length === 0) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        No gear linked to this session yet.
      </p>
    )
  }

  return (
    <ul className="space-y-2 rounded-lg border p-4">
      {linkedItems.map((gearItem) => (
        <li key={gearItem.id} className="space-y-1 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="font-medium">{gearItem.name}</span>
            <p className="shrink-0 text-right text-xs text-muted-foreground">
              {formatGearTypeLabel(gearItem.gear_type)} · {formatGearStatusLabel(gearItem.status)}
            </p>
          </div>
          {formatGearIdentifiers({
            serialNumber: gearItem.serial_number,
            barcode: gearItem.barcode,
          }) ? (
            <p className="text-xs text-muted-foreground">
              {formatGearIdentifiers({
                serialNumber: gearItem.serial_number,
                barcode: gearItem.barcode,
              })}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export type SessionGearTabPanelProps = {
  sessionId: string
  scope: NavigationScope
  gearCatalogPage: SessionDetailCatalogPage
  gearItems: SessionDetailGearItem[]
  gearType: SessionDetailGearTypeFilter
  linkedGearItemIds: string[]
  canManageSession: boolean
}

export function SessionGearTabPanel(input: SessionGearTabPanelProps) {
  const [gearItems, setGearItems] = React.useState<SessionDetailGearItem[]>(input.gearItems)
  const [gearCatalogPage, setGearCatalogPage] =
    React.useState<SessionDetailCatalogPage>(input.gearCatalogPage)
  const [gearType, setGearType] = React.useState<SessionDetailGearTypeFilter>(input.gearType)
  const [linkedGearItemIds, setLinkedGearItemIds] = React.useState<string[]>(() =>
    [...new Set(input.linkedGearItemIds)],
  )

  React.useEffect(() => {
    setGearItems(input.gearItems)
  }, [input.gearItems])

  React.useEffect(() => {
    setGearCatalogPage(input.gearCatalogPage)
  }, [input.gearCatalogPage])

  React.useEffect(() => {
    setGearType(input.gearType)
  }, [input.gearType])

  React.useEffect(() => {
    setLinkedGearItemIds([...new Set(input.linkedGearItemIds)])
  }, [input.linkedGearItemIds])

  const handleGearCatalogLoad = React.useCallback(
    (result: {
      gearCatalogPage: SessionDetailCatalogPage
      gearItems: SessionDetailGearItem[]
      gearType: SessionDetailGearTypeFilter
      mode: "append" | "replace"
    }) => {
      setGearItems((currentItems) =>
        result.mode === "append"
          ? mergeGearItemsById(currentItems, result.gearItems)
          : mergeGearItemsById(
              result.gearItems,
              currentItems.filter((gearItem) => linkedGearItemIds.includes(gearItem.id)),
            ),
      )
      setGearCatalogPage(result.gearCatalogPage)
      setGearType(result.gearType)
    },
    [linkedGearItemIds],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Gear</h3>
        </div>
        {input.canManageSession && (gearItems.length > 0 || gearCatalogPage.totalCount > 0) ? (
          <SessionGearLinkDialog
            gearCatalogPage={gearCatalogPage}
            gearType={gearType}
            sessionId={input.sessionId}
            scope={input.scope}
            gearItems={gearItems}
            linkedGearItemIds={linkedGearItemIds}
            onCatalogLoad={handleGearCatalogLoad}
            onSaved={setLinkedGearItemIds}
          />
        ) : null}
      </div>

      {input.canManageSession && gearItems.length === 0 && gearCatalogPage.totalCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          No gear items exist for this team yet. Add items in Team Gear first.
        </p>
      ) : null}

      <SessionGearPanel
        gearItems={gearItems}
        linkedGearItemIds={linkedGearItemIds}
      />
    </div>
  )
}
