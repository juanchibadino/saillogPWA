"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CameraIcon, Loader2Icon } from "lucide-react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  saveSessionGearUsageAction,
  updateSessionGearUsageAction,
} from "@/features/sessions/actions"
import type { SessionDetailGearItem } from "@/features/sessions/detail-types"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

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
  onDetected,
  disabled = false,
}: {
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={<Button type="button" variant="outline" disabled={disabled} />}
      >
        <CameraIcon className="size-4" />
        Scan
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
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

  const content = (
    <>
      <div className={surface === "sheet" ? "sm:mr-auto" : undefined}>
        <SessionGearBarcodeScannerDialog disabled={isPending} onDetected={onScanned} />
      </div>
      <div className={surface === "sheet" ? "sm:ml-auto" : undefined}>
        <SessionGearSubmitButton
          className={surface === "drawer" ? "w-full" : undefined}
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
  sessionId: string
  scope: NavigationScope
  gearItems: SessionDetailGearItem[]
  linkedGearItemIds: string[]
  onSaved: (linkedGearItemIds: string[]) => void
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectorTab, setSelectorTab] = React.useState<SessionGearSelectorTab>("all")
  const [selectedGearItemIds, setSelectedGearItemIds] = React.useState<string[]>(() =>
    [...new Set(input.linkedGearItemIds)],
  )
  const [isSavingGear, setIsSavingGear] = React.useState(false)
  const [scanFeedbackMessage, setScanFeedbackMessage] = React.useState<string | null>(null)
  const [scanFeedbackType, setScanFeedbackType] = React.useState<"success" | "error">("success")
  const router = useRouter()
  const isMobile = useIsMobile()
  const availableGearTypes = React.useMemo(() => {
    const presentTypes = new Set(input.gearItems.map((gearItem) => gearItem.gear_type))
    return GEAR_TYPE_TAB_ORDER.filter((gearType) => presentTypes.has(gearType))
  }, [input.gearItems])

  const gearItemsByType = React.useMemo(() => {
    const groupedItems = new Map<SessionDetailGearItem["gear_type"], SessionDetailGearItem[]>()

    for (const gearType of availableGearTypes) {
      groupedItems.set(gearType, [])
    }

    for (const gearItem of input.gearItems) {
      const existingItems = groupedItems.get(gearItem.gear_type)

      if (!existingItems) {
        continue
      }

      existingItems.push(gearItem)
    }

    return groupedItems
  }, [availableGearTypes, input.gearItems])

  React.useEffect(() => {
    if (!isOpen) {
      return
    }

    setSelectedGearItemIds([...new Set(input.linkedGearItemIds)])
    setSelectorTab("all")
    setScanFeedbackMessage(null)
  }, [availableGearTypes, isOpen, input.linkedGearItemIds])

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

  function handleBarcodeScanned(barcodeValue: string): void {
    const normalizedBarcode = normalizeBarcodeValue(barcodeValue).toLowerCase()

    if (normalizedBarcode.length === 0) {
      setScanFeedbackType("error")
      setScanFeedbackMessage("Barcode is not registered")
      return
    }

    const matchedGearItem = input.gearItems.find((gearItem) => {
      if (!gearItem.barcode) {
        return false
      }

      return normalizeBarcodeValue(gearItem.barcode).toLowerCase() === normalizedBarcode
    })

    if (!matchedGearItem) {
      setScanFeedbackType("error")
      setScanFeedbackMessage("Barcode is not registered")
      return
    }

    setSelectedGearItemIds((currentIds) =>
      currentIds.includes(matchedGearItem.id)
        ? currentIds
        : [...currentIds, matchedGearItem.id],
    )
    setSelectorTab("linked")
    setScanFeedbackType("success")
    setScanFeedbackMessage(`Linked: ${matchedGearItem.name}`)
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
  const linkedGearItems = input.gearItems.filter((gearItem) =>
    selectedGearItemIdSet.has(gearItem.id),
  )
  const activeSelectorTab: SessionGearSelectorTab =
    selectorTab === "all" ||
    selectorTab === "linked" ||
    availableGearTypes.includes(selectorTab as SessionDetailGearItem["gear_type"])
      ? selectorTab
      : "all"

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
        {input.gearItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No gear items exist for this team yet. Add items in Team Gear first.
          </p>
        ) : (
          <Tabs
            value={activeSelectorTab}
            onValueChange={(value) => setSelectorTab(value as SessionGearSelectorTab)}
            className="min-h-0 space-y-3"
          >
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="all">All Gear ({input.gearItems.length})</TabsTrigger>
              <TabsTrigger value="linked">Linked ({linkedGearItems.length})</TabsTrigger>
              {availableGearTypes.map((gearType) => (
                <TabsTrigger key={gearType} value={gearType} className="capitalize">
                  {formatGearTypeLabel(gearType)} ({gearItemsByType.get(gearType)?.length ?? 0})
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="space-y-3">
              <div className="space-y-3 pr-1">
                {input.gearItems.map((gearItem) => renderGearCard(gearItem))}
              </div>
            </TabsContent>

            <TabsContent value="linked" className="space-y-3">
              {linkedGearItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No gear currently linked in this selection.
                </p>
              ) : (
                <div className="space-y-3 pr-1">
                  {linkedGearItems.map((gearItem) => renderGearCard(gearItem))}
                </div>
              )}
            </TabsContent>

            {availableGearTypes.map((gearType) => (
              <TabsContent key={gearType} value={gearType} className="space-y-3">
                <div className="space-y-3 pr-1">
                  {(gearItemsByType.get(gearType) ?? []).map((gearItem) =>
                    renderGearCard(gearItem),
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
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
            <DrawerDescription>Select the gear used in this session.</DrawerDescription>
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
          <SheetDescription>Select the gear used in this session.</SheetDescription>
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
  gearItems: SessionDetailGearItem[]
  linkedGearItemIds: string[]
  canManageSession: boolean
}

export function SessionGearTabPanel(input: SessionGearTabPanelProps) {
  const [linkedGearItemIds, setLinkedGearItemIds] = React.useState<string[]>(() =>
    [...new Set(input.linkedGearItemIds)],
  )

  React.useEffect(() => {
    setLinkedGearItemIds([...new Set(input.linkedGearItemIds)])
  }, [input.linkedGearItemIds])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Gear</h3>
        </div>
        {input.canManageSession && input.gearItems.length > 0 ? (
          <SessionGearLinkDialog
            sessionId={input.sessionId}
            scope={input.scope}
            gearItems={input.gearItems}
            linkedGearItemIds={linkedGearItemIds}
            onSaved={setLinkedGearItemIds}
          />
        ) : null}
      </div>

      {input.canManageSession && input.gearItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No gear items exist for this team yet. Add items in Team Gear first.
        </p>
      ) : null}

      <SessionGearPanel
        gearItems={input.gearItems}
        linkedGearItemIds={linkedGearItemIds}
      />
    </div>
  )
}
