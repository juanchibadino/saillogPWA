"use client"

import * as React from "react"
import { CameraIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Multiselect,
  MultiselectBadge,
  MultiselectBadgeList,
  MultiselectContent,
  MultiselectEmpty,
  MultiselectInput,
  MultiselectItem,
  MultiselectTrigger,
} from "@/components/ui/multiselect"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  updateSessionDetailAction,
  updateSessionGearUsageAction,
  updateSessionInfoAction,
  updateSessionResultsAction,
  updateSessionSetupAction,
  uploadSessionAssetAction,
} from "@/features/sessions/actions"
import type {
  SessionDetailAsset,
  SessionDetailGearItem,
  SessionSetupDialogItem,
} from "@/features/sessions/detail-types"
import {
  SESSION_DETAIL_TABS,
  type SessionDetailTab,
} from "@/features/sessions/navigation"
import type { NavigationScope } from "@/lib/navigation/types"

function formatTimeInputValue(iso: string | null): string {
  if (!iso) {
    return ""
  }

  const date = new Date(iso)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const hours = String(date.getUTCHours()).padStart(2, "0")
  const minutes = String(date.getUTCMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

function formatDurationHoursInputValue(input: {
  dockOutAt: string | null
  dockInAt: string | null
  fallbackNetTimeMinutes: number | null
}): string {
  let minutes: number | null = input.fallbackNetTimeMinutes

  if (input.dockOutAt && input.dockInAt) {
    const start = new Date(input.dockOutAt)
    const end = new Date(input.dockInAt)

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const diffMinutes = Math.floor((end.getTime() - start.getTime()) / (60 * 1000))
      if (diffMinutes >= 0) {
        minutes = diffMinutes
      }
    }
  }

  if (minutes === null || minutes <= 0) {
    return ""
  }

  const hours = minutes / 60
  const rounded = Math.round(hours * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

function formatAssetSize(sizeBytes: number | null): string {
  if (typeof sizeBytes !== "number" || sizeBytes < 0) {
    return "Size unknown"
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
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

function renderTextValue(value: string | null): string {
  if (!value) {
    return "—"
  }

  return value
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

type SetupDraftByItemId = Record<
  string,
  {
    textValue: string
    selectedOptionIds: string[]
  }
>

function buildInitialSetupDraft(items: SessionSetupDialogItem[]): SetupDraftByItemId {
  const draft: SetupDraftByItemId = {}

  for (const item of items) {
    draft[item.id] = {
      textValue: item.textValue,
      selectedOptionIds: [...item.selectedOptionIds],
    }
  }

  return draft
}

function SetupDialogFooter(input: {
  isEditMode: boolean
  onToggleEdit: () => void
}) {
  const { pending } = useFormStatus()

  return (
    <DialogFooter
      className={
        input.isEditMode
          ? "relative z-10 shrink-0 flex-row items-center justify-between border-t bg-popover pt-4"
          : "relative z-10 shrink-0 flex-row items-center justify-start border-t bg-popover pt-4"
      }
    >
      <Button
        type="button"
        variant={input.isEditMode ? "secondary" : "outline"}
        size="sm"
        onClick={input.onToggleEdit}
        disabled={pending}
      >
        {input.isEditMode ? "Done editing" : "Edit"}
      </Button>
      {input.isEditMode ? (
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Saving setup...
            </>
          ) : (
            "Save setup"
          )}
        </Button>
      ) : null}
    </DialogFooter>
  )
}

function SetupDialog(input: {
  sessionId: string
  scope: NavigationScope
  items: SessionSetupDialogItem[]
}) {
  function SetupDialogFieldset(props: { children: React.ReactNode }) {
    const { pending } = useFormStatus()

    return (
      <fieldset
        disabled={pending}
        className="m-0 h-full min-h-0 min-w-0 overflow-hidden border-0 p-0"
      >
        {props.children}
      </fieldset>
    )
  }

  const [isOpen, setIsOpen] = React.useState(false)
  const [isEditMode, setIsEditMode] = React.useState(false)
  const [draftByItemId, setDraftByItemId] = React.useState<SetupDraftByItemId>(() =>
    buildInitialSetupDraft(input.items),
  )

  const payloadValue = React.useMemo(
    () =>
      JSON.stringify(
        input.items.map((item) => ({
          itemId: item.id,
          textValue: draftByItemId[item.id]?.textValue ?? "",
          selectedOptionIds: draftByItemId[item.id]?.selectedOptionIds ?? [],
        })),
      ),
    [draftByItemId, input.items],
  )

  function updateTextValue(itemId: string, nextValue: string) {
    setDraftByItemId((previousState) => ({
      ...previousState,
      [itemId]: {
        textValue: nextValue,
        selectedOptionIds: previousState[itemId]?.selectedOptionIds ?? [],
      },
    }))
  }

  function updateSelectedOptionIds(itemId: string, nextSelectedOptionIds: string[]) {
    setDraftByItemId((previousState) => ({
      ...previousState,
      [itemId]: {
        textValue: previousState[itemId]?.textValue ?? "",
        selectedOptionIds: Array.from(new Set(nextSelectedOptionIds)),
      },
    }))
  }

  function renderField(item: SessionSetupDialogItem) {
    const draft = draftByItemId[item.id] ?? {
      textValue: "",
      selectedOptionIds: [],
    }
    const fieldId = `setup-item-${item.id}`

    if (item.inputKind === "text") {
      return (
        <Input
          id={fieldId}
          value={draft.textValue}
          onChange={(event) => updateTextValue(item.id, event.target.value)}
          placeholder={`Enter ${item.label.toLowerCase()}`}
        />
      )
    }

    return (
      <Multiselect
        value={draft.selectedOptionIds}
        onValueChange={(nextValues) => updateSelectedOptionIds(item.id, nextValues)}
      >
        <MultiselectTrigger
          id={fieldId}
          placeholder={item.options.length > 0 ? "Select options" : "No options configured"}
          disabled={item.options.length === 0}
        >
          <MultiselectBadgeList>
            {draft.selectedOptionIds.map((selectedId) => {
              const selectedOption = item.options.find((option) => option.id === selectedId)

              if (!selectedOption) {
                return null
              }

              return (
                <MultiselectBadge key={selectedOption.id} value={selectedOption.id}>
                  {selectedOption.label}
                </MultiselectBadge>
              )
            })}
          </MultiselectBadgeList>
        </MultiselectTrigger>
        <MultiselectContent>
          <MultiselectInput placeholder="Search options..." />
          <MultiselectEmpty>No options found.</MultiselectEmpty>
          {item.options.map((option) => (
            <MultiselectItem key={option.id} value={option.id}>
              {option.label}
            </MultiselectItem>
          ))}
        </MultiselectContent>
      </Multiselect>
    )
  }

  function renderReadOnlyField(item: SessionSetupDialogItem): React.ReactNode | null {
    const draft = draftByItemId[item.id] ?? {
      textValue: "",
      selectedOptionIds: [],
    }

    if (item.inputKind === "text") {
      const normalized = draft.textValue.trim()

      if (normalized.length === 0) {
        return null
      }

      return <p className="text-sm text-foreground whitespace-pre-wrap">{normalized}</p>
    }

    const selectedLabels = draft.selectedOptionIds
      .map((selectedId) => item.options.find((option) => option.id === selectedId)?.label ?? null)
      .filter((label): label is string => label !== null)

    if (selectedLabels.length === 0) {
      return null
    }

    return (
      <div className="flex flex-wrap gap-1">
        {selectedLabels.map((label, index) => (
          <Badge key={`${item.id}-${index}`} variant="secondary" className="h-6">
            {label}
          </Badge>
        ))}
      </div>
    )
  }

  function renderFieldHint(item: SessionSetupDialogItem): string | null {
    if (item.inputKind !== "text" && item.options.length === 0) {
      return "This metric has no options configured for this team yet."
    }

    return null
  }

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)

    if (nextOpen) {
      setDraftByItemId(buildInitialSetupDraft(input.items))
      setIsEditMode(false)
      return
    }

    setDraftByItemId(buildInitialSetupDraft(input.items))
    setIsEditMode(false)
  }

  const readOnlyItems = input.items
    .map((item) => ({
      item,
      value: renderReadOnlyField(item),
    }))
    .filter((entry): entry is { item: SessionSetupDialogItem; value: React.ReactNode } => entry.value !== null)

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Setup
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Boat setup</DialogTitle>
          <DialogDescription>
            Review session setup values or switch to edit mode to update them.
          </DialogDescription>
        </DialogHeader>

        <form
          action={updateSessionSetupAction}
          className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden"
        >
          <input type="hidden" name="sessionId" value={input.sessionId} />
          <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
          {input.scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
          ) : null}
          <input type="hidden" name="scopeTab" value="info" />
          <input type="hidden" name="setupPayload" value={payloadValue} />

          <SetupDialogFieldset>
            <div className="no-scrollbar h-full min-h-0 overflow-y-auto pr-1">
              <div className="space-y-4 pb-4">
                  {input.items.length === 0 ? (
                    <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                      No setup metrics are configured for this team yet.
                    </div>
                  ) : !isEditMode ? (
                    readOnlyItems.length > 0 ? (
                      <div className="space-y-3">
                        {readOnlyItems.map((entry) => (
                          <div key={entry.item.id} className="rounded-lg border p-3">
                            <p className="mb-2 text-sm font-medium">{entry.item.label}</p>
                            {entry.value}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                        No setup values have been recorded for this session yet.
                      </div>
                    )
                  ) : (
                    <div className="space-y-3">
                      {input.items.map((item) => (
                        <div key={item.id} className="rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <Label htmlFor={`setup-item-${item.id}`} className="text-sm font-medium">
                              <span className="block w-24 truncate sm:w-32">{item.label}</span>
                            </Label>
                            <div className="min-w-0 flex-1">{renderField(item)}</div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit setup metric ${item.label}`}
                              >
                                <PencilIcon />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Delete setup metric ${item.label}`}
                              >
                                <Trash2Icon />
                              </Button>
                            </div>
                          </div>
                          {renderFieldHint(item) ? (
                            <p className="mt-2 text-xs text-muted-foreground">{renderFieldHint(item)}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {isEditMode ? (
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/30"
                    >
                      <PlusIcon className="size-4" />
                      Add New setup metric
                    </button>
                  ) : null}
              </div>
            </div>
          </SetupDialogFieldset>

          <SetupDialogFooter
            isEditMode={isEditMode}
            onToggleEdit={() => setIsEditMode((currentMode) => !currentMode)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditSessionMetadataDialog(input: {
  sessionId: string
  scope: NavigationScope
  sessionType: "training" | "regatta"
  sessionDate: string
  dockOutAt: string | null
  dockInAt: string | null
  netTimeMinutes: number | null
}) {
  function EditSessionDialogSubmitButton() {
    const { pending } = useFormStatus()

    return (
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Saving changes...
          </>
        ) : (
          "Save changes"
        )}
      </Button>
    )
  }

  function EditSessionDialogFieldset(props: { children: React.ReactNode }) {
    const { pending } = useFormStatus()

    return <fieldset disabled={pending}>{props.children}</fieldset>
  }

  const [nextSessionType, setNextSessionType] = React.useState(input.sessionType)
  const [nextSessionDate, setNextSessionDate] = React.useState(input.sessionDate)
  const [nextStartTime, setNextStartTime] = React.useState(formatTimeInputValue(input.dockOutAt))
  const [nextTotalDurationHours, setNextTotalDurationHours] = React.useState(
    formatDurationHoursInputValue({
      dockOutAt: input.dockOutAt,
      dockInAt: input.dockInAt,
      fallbackNetTimeMinutes: input.netTimeMinutes,
    }),
  )

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit session</DialogTitle>
          <DialogDescription>Update type, date, and session timing.</DialogDescription>
        </DialogHeader>

        <form action={updateSessionDetailAction} className="space-y-4">
          <input type="hidden" name="id" value={input.sessionId} />
          <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
          {input.scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
          ) : null}
          <input type="hidden" name="scopeTab" value="info" />

          <EditSessionDialogFieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`session-type-${input.sessionId}`}>Type</Label>
                <select
                  id={`session-type-${input.sessionId}`}
                  name="sessionType"
                  required
                  value={nextSessionType}
                  onChange={(event) => setNextSessionType(event.target.value as "training" | "regatta")}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="training">Training</option>
                  <option value="regatta">Regatta</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`session-date-${input.sessionId}`}>Date</Label>
                <Input
                  id={`session-date-${input.sessionId}`}
                  name="sessionDate"
                  type="date"
                  required
                  value={nextSessionDate}
                  onChange={(event) => setNextSessionDate(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`session-start-${input.sessionId}`}>Start Time (UTC)</Label>
                <Input
                  id={`session-start-${input.sessionId}`}
                  name="startTime"
                  type="time"
                  value={nextStartTime}
                  onChange={(event) => setNextStartTime(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`session-duration-${input.sessionId}`}>
                  Total Duration (hours, optional)
                </Label>
                <Input
                  id={`session-duration-${input.sessionId}`}
                  name="totalDurationHours"
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  placeholder="e.g. 2"
                  value={nextTotalDurationHours}
                  onChange={(event) => setNextTotalDurationHours(event.target.value)}
                />
              </div>
            </div>
          </EditSessionDialogFieldset>

          <DialogFooter>
            <EditSessionDialogSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function InfoEditDialog(input: {
  sessionId: string
  scope: NavigationScope
  bestOfSession: string | null
  toWork: string | null
  standardMoves: string | null
  windPatterns: string | null
  freeNotes: string | null
}) {
  function InfoDialogSubmitButton() {
    const { pending } = useFormStatus()

    return (
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Saving info...
          </>
        ) : (
          "Save info"
        )}
      </Button>
    )
  }

  function InfoDialogFieldset(props: { children: React.ReactNode }) {
    const { pending } = useFormStatus()

    return <fieldset disabled={pending} className="space-y-4">{props.children}</fieldset>
  }

  const [bestOfSession, setBestOfSession] = React.useState(input.bestOfSession ?? "")
  const [toWork, setToWork] = React.useState(input.toWork ?? "")
  const [standardMoves, setStandardMoves] = React.useState(input.standardMoves ?? "")
  const [windPatterns, setWindPatterns] = React.useState(input.windPatterns ?? "")
  const [freeNotes, setFreeNotes] = React.useState(input.freeNotes ?? "")

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Edit info
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit session info</DialogTitle>
          <DialogDescription>
            Update the coaching notes fields for this session.
          </DialogDescription>
        </DialogHeader>

        <form action={updateSessionInfoAction} className="space-y-4">
          <input type="hidden" name="sessionId" value={input.sessionId} />
          <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
          {input.scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
          ) : null}
          <input type="hidden" name="scopeTab" value="info" />

          <InfoDialogFieldset>
            <div className="space-y-2">
              <Label htmlFor={`best-of-session-${input.sessionId}`}>Best</Label>
              <Textarea
                id={`best-of-session-${input.sessionId}`}
                name="bestOfSession"
                rows={3}
                maxLength={4000}
                value={bestOfSession}
                onChange={(event) => setBestOfSession(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`to-work-${input.sessionId}`}>To Work</Label>
              <Textarea
                id={`to-work-${input.sessionId}`}
                name="toWork"
                rows={3}
                maxLength={4000}
                value={toWork}
                onChange={(event) => setToWork(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`standard-moves-${input.sessionId}`}>Std. Moves</Label>
              <Textarea
                id={`standard-moves-${input.sessionId}`}
                name="standardMoves"
                rows={3}
                maxLength={4000}
                value={standardMoves}
                onChange={(event) => setStandardMoves(event.target.value)}
                placeholder="Plain text or JSON"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`wind-patterns-${input.sessionId}`}>Wind Patterns</Label>
              <Textarea
                id={`wind-patterns-${input.sessionId}`}
                name="windPatterns"
                rows={3}
                maxLength={4000}
                value={windPatterns}
                onChange={(event) => setWindPatterns(event.target.value)}
                placeholder="Plain text or JSON"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`free-notes-${input.sessionId}`}>Free Notes</Label>
              <Textarea
                id={`free-notes-${input.sessionId}`}
                name="freeNotes"
                rows={4}
                maxLength={4000}
                value={freeNotes}
                onChange={(event) => setFreeNotes(event.target.value)}
              />
            </div>
          </InfoDialogFieldset>

          <DialogFooter>
            <InfoDialogSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResultsEditDialog(input: {
  sessionId: string
  scope: NavigationScope
  resultNotes: string | null
}) {
  function ResultsDialogFieldset(props: { children: React.ReactNode }) {
    const { pending } = useFormStatus()

    return <fieldset disabled={pending}>{props.children}</fieldset>
  }

  const [resultNotes, setResultNotes] = React.useState(input.resultNotes ?? "")

  function ResultsDialogSubmitButton() {
    const { pending } = useFormStatus()

    return (
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Saving results...
          </>
        ) : (
          "Save results"
        )}
      </Button>
    )
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Edit results
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit regatta results</DialogTitle>
          <DialogDescription>
            Save race outcomes or any free-form result notes for this session.
          </DialogDescription>
        </DialogHeader>

        <form action={updateSessionResultsAction} className="space-y-4">
          <input type="hidden" name="sessionId" value={input.sessionId} />
          <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
          {input.scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
          ) : null}
          <input type="hidden" name="scopeTab" value="results" />

          <ResultsDialogFieldset>
            <div className="space-y-2">
              <Label htmlFor={`result-notes-${input.sessionId}`}>Result notes</Label>
              <Textarea
                id={`result-notes-${input.sessionId}`}
                name="resultNotes"
                rows={10}
                maxLength={4000}
                value={resultNotes}
                onChange={(event) => setResultNotes(event.target.value)}
                placeholder="Race result details, fleet notes, penalties, and post-race comments..."
              />
            </div>
          </ResultsDialogFieldset>

          <DialogFooter>
            <ResultsDialogSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AssetList(input: {
  assets: SessionDetailAsset[]
  emptyMessage: string
}) {
  if (input.assets.length === 0) {
    return <p className="text-sm text-muted-foreground">{input.emptyMessage}</p>
  }

  return (
    <ul className="divide-y divide-border rounded-lg border">
      {input.assets.map((asset) => (
        <li key={asset.id} className="space-y-1 px-4 py-3">
          <p className="text-sm font-medium">{asset.file_name}</p>
          <p className="text-xs text-muted-foreground">
            {formatAssetSize(asset.size_bytes)} · {formatAssetUploadedAt(asset.created_at)}
          </p>
        </li>
      ))}
    </ul>
  )
}

function AssetUploadForm(input: {
  sessionId: string
  scope: NavigationScope
  assetType: "photo" | "analytics_file"
  tab: "images" | "analytics"
  accept: string
  buttonLabel: string
}) {
  return (
    <form action={uploadSessionAssetAction} className="space-y-3 rounded-lg border p-4">
      <input type="hidden" name="sessionId" value={input.sessionId} />
      <input type="hidden" name="assetType" value={input.assetType} />
      <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
      {input.scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
      ) : null}
      <input type="hidden" name="scopeTab" value={input.tab} />

      <div className="space-y-2">
        <Label htmlFor={`${input.assetType}-file-${input.sessionId}`}>Choose file</Label>
        <Input
          id={`${input.assetType}-file-${input.sessionId}`}
          name="assetFile"
          type="file"
          required
          accept={input.accept}
        />
      </div>

      <Button type="submit" size="sm">
        {input.buttonLabel}
      </Button>
    </form>
  )
}

function SessionGearDialogFields({
  children,
}: {
  children: React.ReactNode
}) {
  const { pending } = useFormStatus()

  return (
    <fieldset disabled={pending} className="space-y-3">
      {children}
    </fieldset>
  )
}

function SessionGearSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          Saving gear...
        </>
      ) : (
        "Save links"
      )}
    </Button>
  )
}

function SessionGearDialogFooter({
  onScanned,
}: {
  onScanned: (barcodeValue: string) => void
}) {
  const { pending } = useFormStatus()

  return (
    <DialogFooter className="sm:justify-between">
      <div className="sm:mr-auto">
        <SessionGearBarcodeScannerDialog disabled={pending} onDetected={onScanned} />
      </div>
      <div className="sm:ml-auto">
        <SessionGearSubmitButton />
      </div>
    </DialogFooter>
  )
}

function SessionGearLinkDialog(input: {
  sessionId: string
  scope: NavigationScope
  gearItems: SessionDetailGearItem[]
  linkedGearItemIds: string[]
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectorTab, setSelectorTab] = React.useState<SessionGearSelectorTab>("all")
  const [selectedGearItemIds, setSelectedGearItemIds] = React.useState<string[]>(() =>
    [...new Set(input.linkedGearItemIds)],
  )
  const [scanFeedbackMessage, setScanFeedbackMessage] = React.useState<string | null>(null)
  const [scanFeedbackType, setScanFeedbackType] = React.useState<"success" | "error">("success")
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
      setScanFeedbackMessage("Barcode is not registerd")
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
      setScanFeedbackMessage("Barcode is not registerd")
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        {input.linkedGearItemIds.length > 0 ? "Edit links" : "Link gear"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link gear to session</DialogTitle>
        </DialogHeader>

        <form action={updateSessionGearUsageAction} className="space-y-4">
          <input type="hidden" name="sessionId" value={input.sessionId} />
          <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
          {input.scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
          ) : null}
          <input type="hidden" name="scopeTab" value="gear" />

          {selectedGearItemIds.map((gearItemId) => (
            <input key={`selected-gear-${gearItemId}`} type="hidden" name="gearItemIds" value={gearItemId} />
          ))}

          <SessionGearDialogFields>
            {input.gearItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No gear items exist for this team yet. Add items in Team Gear first.
              </p>
            ) : (
              <Tabs
                value={activeSelectorTab}
                onValueChange={(value) => setSelectorTab(value as SessionGearSelectorTab)}
                className="space-y-3"
              >
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
                  <TabsTrigger value="all">
                    All Gear ({input.gearItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="linked">
                    Linked ({linkedGearItems.length})
                  </TabsTrigger>
                  {availableGearTypes.map((gearType) => (
                    <TabsTrigger key={gearType} value={gearType} className="capitalize">
                      {formatGearTypeLabel(gearType)} ({gearItemsByType.get(gearType)?.length ?? 0})
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="all" className="space-y-3">
                  <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                    {input.gearItems.map((gearItem) => renderGearCard(gearItem))}
                  </div>
                </TabsContent>

                <TabsContent value="linked" className="space-y-3">
                  {linkedGearItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No gear currently linked in this selection.
                    </p>
                  ) : (
                    <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                      {linkedGearItems.map((gearItem) => renderGearCard(gearItem))}
                    </div>
                  )}
                </TabsContent>

                {availableGearTypes.map((gearType) => (
                  <TabsContent key={gearType} value={gearType} className="space-y-3">
                    <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
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
                  ? "text-sm text-rose-700"
                  : "text-sm text-emerald-700"
              }
            >
              {scanFeedbackMessage}
            </p>
          ) : null}
          <SessionGearDialogFooter onScanned={handleBarcodeScanned} />
        </form>
      </DialogContent>
    </Dialog>
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

function resolveTab(value: string): SessionDetailTab {
  return SESSION_DETAIL_TABS.includes(value as SessionDetailTab)
    ? (value as SessionDetailTab)
    : "info"
}

export function SessionHeaderActions(input: {
  sessionId: string
  scope: NavigationScope
  setupDialogItems: SessionSetupDialogItem[]
  sessionType: "training" | "regatta"
  sessionDate: string
  dockOutAt: string | null
  dockInAt: string | null
  netTimeMinutes: number | null
  canManageSession: boolean
}) {
  if (!input.canManageSession) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <SetupDialog
        sessionId={input.sessionId}
        scope={input.scope}
        items={input.setupDialogItems}
      />
      <EditSessionMetadataDialog
        sessionId={input.sessionId}
        scope={input.scope}
        sessionType={input.sessionType}
        sessionDate={input.sessionDate}
        dockOutAt={input.dockOutAt}
        dockInAt={input.dockInAt}
        netTimeMinutes={input.netTimeMinutes}
      />
    </div>
  )
}

export function SessionDetailTabsClient(input: {
  initialTab: SessionDetailTab
  scope: NavigationScope
  sessionId: string
  sessionType: "training" | "regatta"
  info: {
    bestOfSession: string | null
    toWork: string | null
    standardMoves: string | null
    windPatterns: string | null
    freeNotes: string | null
  }
  resultNotes: string | null
  images: SessionDetailAsset[]
  analyticsFiles: SessionDetailAsset[]
  gearItems: SessionDetailGearItem[]
  linkedGearItemIds: string[]
  canManageSession: boolean
}) {
  const [selectedTab, setSelectedTab] = React.useState<SessionDetailTab>(input.initialTab)

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => setSelectedTab(resolveTab(value))}
      className="space-y-4"
    >
      <TabsList className="h-10">
        {SESSION_DETAIL_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="min-w-fit capitalize">
            {tab}
          </TabsTrigger>
        ))}
      </TabsList>

      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <TabsContent value="info" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Session Info</h3>
              <p className="text-sm text-muted-foreground">
                Coaching summary and tactical observations.
              </p>
            </div>
            {input.canManageSession ? (
              <InfoEditDialog
                sessionId={input.sessionId}
                scope={input.scope}
                bestOfSession={input.info.bestOfSession}
                toWork={input.info.toWork}
                standardMoves={input.info.standardMoves}
                windPatterns={input.info.windPatterns}
                freeNotes={input.info.freeNotes}
              />
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{renderTextValue(input.info.bestOfSession)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">To Work</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{renderTextValue(input.info.toWork)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Std. Moves</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{renderTextValue(input.info.standardMoves)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wind Patterns</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{renderTextValue(input.info.windPatterns)}</p>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Free Notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{renderTextValue(input.info.freeNotes)}</p>
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Results</h3>
              <p className="text-sm text-muted-foreground">
                {input.sessionType === "regatta"
                  ? "Regatta race outcomes and summary notes."
                  : "Training sessions can keep optional result-style notes here."}
              </p>
            </div>
            {input.canManageSession ? (
              <ResultsEditDialog
                sessionId={input.sessionId}
                scope={input.scope}
                resultNotes={input.resultNotes}
              />
            ) : null}
          </div>

          <div className="rounded-lg border p-4">
            <p className="whitespace-pre-wrap text-sm">{renderTextValue(input.resultNotes)}</p>
          </div>
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">Images</h3>
            <p className="text-sm text-muted-foreground">
              Upload photos from training or regatta sessions.
            </p>
          </div>

          {input.canManageSession ? (
            <AssetUploadForm
              sessionId={input.sessionId}
              scope={input.scope}
              assetType="photo"
              tab="images"
              accept="image/*"
              buttonLabel="Upload image"
            />
          ) : null}

          <AssetList
            assets={input.images}
            emptyMessage="No images uploaded for this session yet."
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Upload analytics files provided by the analytics team.
            </p>
          </div>

          {input.canManageSession ? (
            <AssetUploadForm
              sessionId={input.sessionId}
              scope={input.scope}
              assetType="analytics_file"
              tab="analytics"
              accept=".csv,.pdf,.json,.zip,.txt,.xlsx,.xls"
              buttonLabel="Upload file"
            />
          ) : null}

          <AssetList
            assets={input.analyticsFiles}
            emptyMessage="No analytics files uploaded for this session yet."
          />
        </TabsContent>

        <TabsContent value="gear" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Gear</h3>
              <p className="text-sm text-muted-foreground">
                Gear linked to this session. Usage totals are computed from session duration.
              </p>
            </div>
            {input.canManageSession && input.gearItems.length > 0 ? (
              <SessionGearLinkDialog
                sessionId={input.sessionId}
                scope={input.scope}
                gearItems={input.gearItems}
                linkedGearItemIds={input.linkedGearItemIds}
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
            linkedGearItemIds={input.linkedGearItemIds}
          />
        </TabsContent>
      </section>
    </Tabs>
  )
}
