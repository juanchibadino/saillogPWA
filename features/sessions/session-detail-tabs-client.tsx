"use client"

import * as React from "react"
import {
  CameraIcon,
  GripVerticalIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SpellCheckIcon,
  Trash2Icon,
} from "lucide-react"
import { useFormStatus } from "react-dom"
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
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
import { Textarea } from "@/components/ui/textarea"
import {
  createTeamSetupMetricAction,
  deleteTeamSetupMetricAction,
  updateTeamSetupMetricAction,
  updateSessionDetailAction,
  updateSessionGearUsageAction,
  updateSessionGoalsAction,
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
import { generateStandardMoveNameFromDescription } from "@/lib/standard-moves"
import { useIsMobile } from "@/hooks/use-mobile"

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

function renderTextList(values: string[]): string {
  if (values.length === 0) {
    return "—"
  }

  return values.join(", ")
}

type SessionNoteTextReplacement = {
  pattern: RegExp
  replacement: string
  preserveCapitalization?: boolean
}

const SESSION_NOTE_TEXT_REPLACEMENTS: SessionNoteTextReplacement[] = [
  { pattern: /\btwd\b/gi, replacement: "TWD" },
  { pattern: /\btws\b/gi, replacement: "TWS" },
  { pattern: /\bvmg\b/gi, replacement: "VMG" },
  { pattern: /\bgps\b/gi, replacement: "GPS" },
  { pattern: /\brib\b/gi, replacement: "RIB" },
  { pattern: /\bi\b/g, replacement: "I" },
  { pattern: /\bteh\b/gi, replacement: "the", preserveCapitalization: true },
  { pattern: /\badn\b/gi, replacement: "and", preserveCapitalization: true },
  { pattern: /\bwich\b/gi, replacement: "which", preserveCapitalization: true },
  { pattern: /\brecieve\b/gi, replacement: "receive", preserveCapitalization: true },
  { pattern: /\brecieved\b/gi, replacement: "received", preserveCapitalization: true },
  { pattern: /\brecieving\b/gi, replacement: "receiving", preserveCapitalization: true },
  { pattern: /\bseperate\b/gi, replacement: "separate", preserveCapitalization: true },
  { pattern: /\boccured\b/gi, replacement: "occurred", preserveCapitalization: true },
  { pattern: /\bbecuase\b/gi, replacement: "because", preserveCapitalization: true },
  { pattern: /\bdefinately\b/gi, replacement: "definitely", preserveCapitalization: true },
  { pattern: /\buntill\b/gi, replacement: "until", preserveCapitalization: true },
  { pattern: /\balot\b/gi, replacement: "a lot", preserveCapitalization: true },
  { pattern: /\bdont\b/gi, replacement: "don't", preserveCapitalization: true },
  { pattern: /\bdidnt\b/gi, replacement: "didn't", preserveCapitalization: true },
  { pattern: /\bwasnt\b/gi, replacement: "wasn't", preserveCapitalization: true },
  { pattern: /\bcant\b/gi, replacement: "can't", preserveCapitalization: true },
  { pattern: /\bwont\b/gi, replacement: "won't", preserveCapitalization: true },
  { pattern: /\bcouldnt\b/gi, replacement: "couldn't", preserveCapitalization: true },
  { pattern: /\bshouldnt\b/gi, replacement: "shouldn't", preserveCapitalization: true },
  { pattern: /\bwouldnt\b/gi, replacement: "wouldn't", preserveCapitalization: true },
]

function applyMatchedCapitalization(replacement: string, matchedValue: string): string {
  const firstCharacter = matchedValue.at(0)

  if (!firstCharacter || firstCharacter !== firstCharacter.toUpperCase()) {
    return replacement
  }

  return `${replacement.at(0)?.toUpperCase() ?? ""}${replacement.slice(1)}`
}

function capitalizeSessionNoteSentences(value: string): string {
  let shouldCapitalize = true
  let result = ""

  for (const character of value) {
    if (shouldCapitalize && /[a-z]/.test(character)) {
      result += character.toUpperCase()
      shouldCapitalize = false
      continue
    }

    result += character

    if (/[A-Za-z0-9]/.test(character)) {
      shouldCapitalize = false
      continue
    }

    if (/[.!?]/.test(character) || character === "\n") {
      shouldCapitalize = true
    }
  }

  return result
}

function correctSessionNoteText(value: string): string {
  let correctedValue = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t]+/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/([,.;:!?])(?=\S)/g, "$1 ")
        .trim(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  for (const replacement of SESSION_NOTE_TEXT_REPLACEMENTS) {
    correctedValue = correctedValue.replace(replacement.pattern, (matchedValue) =>
      replacement.preserveCapitalization
        ? applyMatchedCapitalization(replacement.replacement, matchedValue)
        : replacement.replacement,
    )
  }

  correctedValue = correctedValue.replace(
    /\b(could|should|would) of\b/gi,
    (matchedValue, modalVerb: string) =>
      `${applyMatchedCapitalization(modalVerb.toLowerCase(), matchedValue)} have`,
  )

  return capitalizeSessionNoteSentences(correctedValue)
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

const WEATHER_METRIC_KEYS = [
  "twd",
  "tws",
  "sea_state",
  "type_of_day",
  "currents",
] as const
const WEATHER_METRIC_ORDER = new Map<string, number>(
  WEATHER_METRIC_KEYS.map((key, index) => [key, index]),
)

type SetupDraftSelectedOption = {
  optionId: string
  allocationPercent: number | null
}

type SetupDraftItem = {
  textValue: string
  selectedOptions: SetupDraftSelectedOption[]
  twsEditedOptionIds: string[]
}

type SetupDraftByItemId = Record<string, SetupDraftItem>

function clampPercentInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  const rounded = Math.round(value)

  if (rounded < 0) {
    return 0
  }

  if (rounded > 100) {
    return 100
  }

  return rounded
}

function distributeEqualIntegerPercentages(count: number, total = 100): number[] {
  if (count <= 0) {
    return []
  }

  const baseValue = Math.floor(total / count)
  const remainder = total - baseValue * count

  return Array.from({ length: count }, (_, index) =>
    index < remainder ? baseValue + 1 : baseValue,
  )
}

function enforceTwsAllocationInvariant(input: {
  selectedOptions: SetupDraftSelectedOption[]
  preferredAddOptionIds: string[]
}): SetupDraftSelectedOption[] {
  if (input.selectedOptions.length === 0) {
    return []
  }

  const orderedOptionIds: string[] = []
  const percentByOptionId = new Map<string, number>()

  for (const selectedOption of input.selectedOptions) {
    if (!orderedOptionIds.includes(selectedOption.optionId)) {
      orderedOptionIds.push(selectedOption.optionId)
    }

    percentByOptionId.set(
      selectedOption.optionId,
      clampPercentInteger(selectedOption.allocationPercent ?? 0),
    )
  }

  if (orderedOptionIds.length === 1) {
    return [{ optionId: orderedOptionIds[0], allocationPercent: 100 }]
  }

  const preferredSet = new Set(
    input.preferredAddOptionIds.filter((optionId) =>
      orderedOptionIds.includes(optionId),
    ),
  )
  const addOrder = [
    ...Array.from(preferredSet),
    ...orderedOptionIds.filter((optionId) => !preferredSet.has(optionId)),
  ]

  let sum = orderedOptionIds.reduce(
    (total, optionId) => total + (percentByOptionId.get(optionId) ?? 0),
    0,
  )

  if (sum < 100) {
    let remainder = 100 - sum

    for (const optionId of addOrder) {
      if (remainder === 0) {
        break
      }

      const currentValue = percentByOptionId.get(optionId) ?? 0
      const capacity = Math.max(0, 100 - currentValue)
      const increment = Math.min(capacity, remainder)

      percentByOptionId.set(optionId, currentValue + increment)
      remainder -= increment
    }
  } else if (sum > 100) {
    let overflow = sum - 100

    for (let index = orderedOptionIds.length - 1; index >= 0; index -= 1) {
      if (overflow === 0) {
        break
      }

      const optionId = orderedOptionIds[index]
      const currentValue = percentByOptionId.get(optionId) ?? 0
      const decrement = Math.min(currentValue, overflow)

      percentByOptionId.set(optionId, currentValue - decrement)
      overflow -= decrement
    }
  }

  sum = orderedOptionIds.reduce(
    (total, optionId) => total + (percentByOptionId.get(optionId) ?? 0),
    0,
  )

  if (sum !== 100) {
    const equalDistribution = distributeEqualIntegerPercentages(orderedOptionIds.length)
    return orderedOptionIds.map((optionId, index) => ({
      optionId,
      allocationPercent: equalDistribution[index] ?? 0,
    }))
  }

  return orderedOptionIds.map((optionId) => ({
    optionId,
    allocationPercent: percentByOptionId.get(optionId) ?? 0,
  }))
}

function sortSelectedOptionIdsByMetricOptions(input: {
  item: SessionSetupDialogItem
  selectedOptionIds: string[]
}): string[] {
  const optionOrderById = new Map(
    input.item.options.map((option, index) => [option.id, index]),
  )

  return [...new Set(input.selectedOptionIds)].sort(
    (left, right) =>
      (optionOrderById.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (optionOrderById.get(right) ?? Number.MAX_SAFE_INTEGER),
  )
}

function rebalanceTwsDraftSelection(input: {
  selectedOptionIds: string[]
  previousSelectedOptions: SetupDraftSelectedOption[]
  previousEditedOptionIds: string[]
  changedOptionId?: string
  changedOptionPercent?: number
}): {
  selectedOptions: SetupDraftSelectedOption[]
  editedOptionIds: string[]
} {
  const selectedOptionIds = [...new Set(input.selectedOptionIds)]

  if (selectedOptionIds.length === 0) {
    return {
      selectedOptions: [],
      editedOptionIds: [],
    }
  }

  if (selectedOptionIds.length === 1) {
    return {
      selectedOptions: [{ optionId: selectedOptionIds[0], allocationPercent: 100 }],
      editedOptionIds: [],
    }
  }

  const previousPercentByOptionId = new Map(
    input.previousSelectedOptions.map((selectedOption) => [
      selectedOption.optionId,
      typeof selectedOption.allocationPercent === "number"
        ? clampPercentInteger(selectedOption.allocationPercent)
        : 0,
    ]),
  )

  if (input.changedOptionId && typeof input.changedOptionPercent === "number") {
    previousPercentByOptionId.set(
      input.changedOptionId,
      clampPercentInteger(input.changedOptionPercent),
    )
  }

  const editedOptionIds = new Set(
    input.previousEditedOptionIds.filter((optionId) =>
      selectedOptionIds.includes(optionId),
    ),
  )

  if (input.changedOptionId) {
    editedOptionIds.add(input.changedOptionId)
  }

  if (editedOptionIds.size === 0) {
    const equalDistribution = distributeEqualIntegerPercentages(selectedOptionIds.length)
    return {
      selectedOptions: selectedOptionIds.map((optionId, index) => ({
        optionId,
        allocationPercent: equalDistribution[index] ?? 0,
      })),
      editedOptionIds: [],
    }
  }

  const fixedOptionIds = selectedOptionIds.filter((optionId) =>
    editedOptionIds.has(optionId),
  )
  const uneditedOptionIds = selectedOptionIds.filter(
    (optionId) => !editedOptionIds.has(optionId),
  )
  const nextPercentByOptionId = new Map<string, number>()

  for (const fixedOptionId of fixedOptionIds) {
    nextPercentByOptionId.set(
      fixedOptionId,
      clampPercentInteger(previousPercentByOptionId.get(fixedOptionId) ?? 0),
    )
  }

  let fixedTotal = fixedOptionIds.reduce(
    (total, optionId) => total + (nextPercentByOptionId.get(optionId) ?? 0),
    0,
  )

  if (input.changedOptionId && fixedTotal > 100) {
    const changedOptionId = input.changedOptionId
    const otherFixedTotal =
      fixedTotal - (nextPercentByOptionId.get(changedOptionId) ?? 0)
    const cappedChangedValue = Math.max(0, 100 - otherFixedTotal)
    nextPercentByOptionId.set(changedOptionId, cappedChangedValue)
    fixedTotal = otherFixedTotal + cappedChangedValue
  }

  if (fixedTotal > 100 && !input.changedOptionId) {
    let remaining = 100

    for (const fixedOptionId of fixedOptionIds) {
      const nextValue = Math.min(
        clampPercentInteger(nextPercentByOptionId.get(fixedOptionId) ?? 0),
        remaining,
      )
      nextPercentByOptionId.set(fixedOptionId, nextValue)
      remaining -= nextValue
    }

    fixedTotal = 100 - remaining
  }

  let remainder = Math.max(0, 100 - fixedTotal)

  if (uneditedOptionIds.length > 0) {
    const distribution = distributeEqualIntegerPercentages(
      uneditedOptionIds.length,
      remainder,
    )

    for (let index = 0; index < uneditedOptionIds.length; index += 1) {
      const optionId = uneditedOptionIds[index]
      nextPercentByOptionId.set(optionId, distribution[index] ?? 0)
    }

    remainder = 0
  } else {
    const adjustableOptionId =
      input.changedOptionId ?? fixedOptionIds[fixedOptionIds.length - 1] ?? null

    if (adjustableOptionId) {
      const adjustedValue = clampPercentInteger(
        (nextPercentByOptionId.get(adjustableOptionId) ?? 0) + remainder,
      )
      nextPercentByOptionId.set(adjustableOptionId, adjustedValue)
      remainder = 0
    }
  }

  if (remainder > 0) {
    const fallbackOptionId = selectedOptionIds[selectedOptionIds.length - 1]
    nextPercentByOptionId.set(
      fallbackOptionId,
      clampPercentInteger((nextPercentByOptionId.get(fallbackOptionId) ?? 0) + remainder),
    )
  }

  const selectedOptions = enforceTwsAllocationInvariant({
    selectedOptions: selectedOptionIds.map((optionId) => ({
      optionId,
      allocationPercent: nextPercentByOptionId.get(optionId) ?? 0,
    })),
    preferredAddOptionIds: [
      ...uneditedOptionIds,
      ...(input.changedOptionId ? [input.changedOptionId] : []),
      ...selectedOptionIds,
    ],
  })

  return {
    selectedOptions,
    editedOptionIds: fixedOptionIds.filter((optionId) => selectedOptionIds.includes(optionId)),
  }
}

function buildInitialSetupDraft(items: SessionSetupDialogItem[]): SetupDraftByItemId {
  const draft: SetupDraftByItemId = {}

  for (const item of items) {
    if (item.inputKind === "text") {
      draft[item.id] = {
        textValue: item.textValue,
        selectedOptions: [],
        twsEditedOptionIds: [],
      }
      continue
    }

    const selectedOptionIds = sortSelectedOptionIdsByMetricOptions({
      item,
      selectedOptionIds: item.selectedOptions.map((selectedOption) => selectedOption.optionId),
    })

    if (item.key !== "tws") {
      draft[item.id] = {
        textValue: item.textValue,
        selectedOptions: selectedOptionIds.map((optionId) => ({
          optionId,
          allocationPercent: null,
        })),
        twsEditedOptionIds: [],
      }
      continue
    }

    const currentPercentByOptionId = new Map(
      item.selectedOptions.map((selectedOption) => [
        selectedOption.optionId,
        typeof selectedOption.allocationPercent === "number"
          ? clampPercentInteger(selectedOption.allocationPercent)
          : null,
      ]),
    )
    const hasAnyMissingPercent = selectedOptionIds.some(
      (optionId) => currentPercentByOptionId.get(optionId) === null,
    )
    const hasAnySelected = selectedOptionIds.length > 0
    const currentSum = selectedOptionIds.reduce(
      (total, optionId) => total + (currentPercentByOptionId.get(optionId) ?? 0),
      0,
    )
    const hasValidExistingPercentages = hasAnySelected && !hasAnyMissingPercent && currentSum === 100
    const selectedOptions = hasValidExistingPercentages
      ? selectedOptionIds.map((optionId) => {
          const percent = currentPercentByOptionId.get(optionId)
          return {
            optionId,
            allocationPercent: typeof percent === "number" ? percent : 0,
          }
        })
      : rebalanceTwsDraftSelection({
          selectedOptionIds,
          previousSelectedOptions: [],
          previousEditedOptionIds: [],
        }).selectedOptions

    draft[item.id] = {
      textValue: item.textValue,
      selectedOptions,
      twsEditedOptionIds: [],
    }
  }

  return draft
}

function groupSetupItems(items: SessionSetupDialogItem[]): {
  weather: SessionSetupDialogItem[]
  boat: SessionSetupDialogItem[]
} {
  const weather = items
    .filter((item) => item.metricGroup === "weather")
    .sort((left, right) => {
      const leftOrder = WEATHER_METRIC_ORDER.get(left.key) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = WEATHER_METRIC_ORDER.get(right.key) ?? Number.MAX_SAFE_INTEGER

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }

      return left.position - right.position
    })
  const boat = items
    .filter((item) => item.metricGroup === "boat")
    .sort((left, right) => left.position - right.position)

  return { weather, boat }
}

function parseMetricOptionsFromText(value: string): string[] {
  const uniqueOptions = new Set<string>()

  for (const line of value.split(/\r?\n/)) {
    const normalized = line.trim().replace(/\s+/g, " ")

    if (normalized.length === 0) {
      continue
    }

    uniqueOptions.add(normalized)
  }

  return [...uniqueOptions]
}

function SetupScopeHiddenFields(input: {
  sessionId: string
  scope: NavigationScope
}) {
  return (
    <>
      <input type="hidden" name="sessionId" value={input.sessionId} />
      <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
      {input.scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
      ) : null}
      <input type="hidden" name="scopeTab" value="info" />
    </>
  )
}

function SortableBoatSetupRow(input: {
  itemId: string
  children: (input: {
    dragHandleProps: React.HTMLAttributes<HTMLButtonElement>
    isDragging: boolean
  }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: input.itemId,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? "opacity-70" : undefined}
    >
      {input.children({
        dragHandleProps: {
          ...attributes,
          ...listeners,
        },
        isDragging,
      })}
    </div>
  )
}

function SetupDialogFooter(input: {
  isEditMode: boolean
  onEnterEditMode: () => void
}) {
  const { pending } = useFormStatus()

  return (
    <DialogFooter
      className={input.isEditMode ? "shrink-0 sm:justify-end" : "shrink-0 sm:justify-start"}
    >
      {!input.isEditMode ? (
        <Button
          key="setup-edit"
          type="button"
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            input.onEnterEditMode()
          }}
          disabled={pending}
        >
          Edit
        </Button>
      ) : (
        <Button key="setup-save" type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
      )}
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

    return <fieldset disabled={pending} className="m-0 border-0 p-0">{props.children}</fieldset>
  }

  function EditSetupMetricFieldset(props: { children: React.ReactNode }) {
    const { pending } = useFormStatus()

    return <fieldset disabled={pending} className="m-0 border-0 p-0">{props.children}</fieldset>
  }

  function EditSetupMetricSubmitButton() {
    const { pending } = useFormStatus()

    return (
      <Button type="submit" disabled={pending}>
        {pending ? (
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

  const groupedItems = React.useMemo(() => groupSetupItems(input.items), [input.items])
  const initialBoatOrderIds = React.useMemo(
    () => groupedItems.boat.map((item) => item.id),
    [groupedItems.boat],
  )
  const boatItemById = React.useMemo(
    () => new Map(groupedItems.boat.map((item) => [item.id, item])),
    [groupedItems.boat],
  )

  const [isOpen, setIsOpen] = React.useState(false)
  const [isEditMode, setIsEditMode] = React.useState(false)
  const [draftByItemId, setDraftByItemId] = React.useState<SetupDraftByItemId>(() =>
    buildInitialSetupDraft(input.items),
  )
  const [boatOrderIds, setBoatOrderIds] = React.useState<string[]>(initialBoatOrderIds)

  const [isCreateMetricDialogOpen, setIsCreateMetricDialogOpen] = React.useState(false)
  const [createMetricStep, setCreateMetricStep] = React.useState<"kind" | "details">("kind")
  const [createMetricKind, setCreateMetricKind] = React.useState<
    "single_select" | "multi_select" | "text" | null
  >(null)
  const [createMetricLabel, setCreateMetricLabel] = React.useState("")
  const [createMetricOptionsText, setCreateMetricOptionsText] = React.useState("")

  const [editingMetricId, setEditingMetricId] = React.useState<string | null>(null)
  const [editingMetricLabel, setEditingMetricLabel] = React.useState("")
  const [editingMetricKind, setEditingMetricKind] = React.useState<
    "single_select" | "multi_select" | "text"
  >("multi_select")
  const [editingMetricOptionsText, setEditingMetricOptionsText] = React.useState("")

  const [deletingMetricId, setDeletingMetricId] = React.useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const payloadValue = React.useMemo(
    () =>
      JSON.stringify(
        input.items.map((item) => {
          const draft = draftByItemId[item.id] ?? {
            textValue: "",
            selectedOptions: [],
            twsEditedOptionIds: [],
          }

          return {
            itemId: item.id,
            textValue: draft.textValue,
            selectedOptions: draft.selectedOptions.map((selectedOption) => ({
              optionId: selectedOption.optionId,
              allocationPercent:
                item.key === "tws" ? selectedOption.allocationPercent : null,
            })),
          }
        }),
      ),
    [draftByItemId, input.items],
  )

  const orderedItemIdsPayload = React.useMemo(
    () => JSON.stringify(boatOrderIds),
    [boatOrderIds],
  )

  const orderedBoatItems = React.useMemo(
    () =>
      boatOrderIds
        .map((itemId) => boatItemById.get(itemId) ?? null)
        .filter((item): item is SessionSetupDialogItem => item !== null),
    [boatItemById, boatOrderIds],
  )

  const editingMetric =
    editingMetricId !== null ? boatItemById.get(editingMetricId) ?? null : null
  const deletingMetric =
    deletingMetricId !== null ? boatItemById.get(deletingMetricId) ?? null : null

  const createMetricOptionsPayload = React.useMemo(
    () =>
      JSON.stringify(
        createMetricKind === "text"
          ? []
          : parseMetricOptionsFromText(createMetricOptionsText),
      ),
    [createMetricKind, createMetricOptionsText],
  )

  const updateMetricOptionsPayload = React.useMemo(
    () =>
      JSON.stringify(
        editingMetricKind === "text"
          ? []
          : parseMetricOptionsFromText(editingMetricOptionsText),
      ),
    [editingMetricKind, editingMetricOptionsText],
  )

  function resetDialogState() {
    setDraftByItemId(buildInitialSetupDraft(input.items))
    setBoatOrderIds(initialBoatOrderIds)
    setIsEditMode(false)
    setIsCreateMetricDialogOpen(false)
    setCreateMetricStep("kind")
    setCreateMetricKind(null)
    setCreateMetricLabel("")
    setCreateMetricOptionsText("")
    setEditingMetricId(null)
    setEditingMetricLabel("")
    setEditingMetricKind("multi_select")
    setEditingMetricOptionsText("")
    setDeletingMetricId(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)
    resetDialogState()
  }

  function updateTextValue(itemId: string, nextValue: string) {
    setDraftByItemId((previousState) => ({
      ...previousState,
      [itemId]: {
        textValue: nextValue,
        selectedOptions: previousState[itemId]?.selectedOptions ?? [],
        twsEditedOptionIds: previousState[itemId]?.twsEditedOptionIds ?? [],
      },
    }))
  }

  function updateSelectedOptionIds(item: SessionSetupDialogItem, nextSelectedOptionIds: string[]) {
    const orderedSelectedOptionIds = sortSelectedOptionIdsByMetricOptions({
      item,
      selectedOptionIds: nextSelectedOptionIds,
    })

    setDraftByItemId((previousState) => {
      const currentDraft = previousState[item.id] ?? {
        textValue: "",
        selectedOptions: [],
        twsEditedOptionIds: [],
      }

      if (item.key !== "tws") {
        return {
          ...previousState,
          [item.id]: {
            ...currentDraft,
            selectedOptions: orderedSelectedOptionIds.map((optionId) => ({
              optionId,
              allocationPercent: null,
            })),
            twsEditedOptionIds: [],
          },
        }
      }

      const rebalanced = rebalanceTwsDraftSelection({
        selectedOptionIds: orderedSelectedOptionIds,
        previousSelectedOptions: currentDraft.selectedOptions,
        previousEditedOptionIds: currentDraft.twsEditedOptionIds,
      })

      return {
        ...previousState,
        [item.id]: {
          ...currentDraft,
          selectedOptions: rebalanced.selectedOptions,
          twsEditedOptionIds: rebalanced.editedOptionIds,
        },
      }
    })
  }

  function updateTwsPercentValue(item: SessionSetupDialogItem, optionId: string, rawValue: string) {
    const parsedValue = rawValue.trim().length === 0 ? 0 : Number.parseInt(rawValue, 10)
    const nextPercent = clampPercentInteger(parsedValue)

    setDraftByItemId((previousState) => {
      const currentDraft = previousState[item.id] ?? {
        textValue: "",
        selectedOptions: [],
        twsEditedOptionIds: [],
      }
      const orderedSelectedOptionIds = sortSelectedOptionIdsByMetricOptions({
        item,
        selectedOptionIds: currentDraft.selectedOptions.map(
          (selectedOption) => selectedOption.optionId,
        ),
      })
      const rebalanced = rebalanceTwsDraftSelection({
        selectedOptionIds: orderedSelectedOptionIds,
        previousSelectedOptions: currentDraft.selectedOptions,
        previousEditedOptionIds: currentDraft.twsEditedOptionIds,
        changedOptionId: optionId,
        changedOptionPercent: nextPercent,
      })

      return {
        ...previousState,
        [item.id]: {
          ...currentDraft,
          selectedOptions: rebalanced.selectedOptions,
          twsEditedOptionIds: rebalanced.editedOptionIds,
        },
      }
    })
  }

  function handleBoatDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    setBoatOrderIds((previousOrder) => {
      const oldIndex = previousOrder.indexOf(String(active.id))
      const newIndex = previousOrder.indexOf(String(over.id))

      if (oldIndex < 0 || newIndex < 0) {
        return previousOrder
      }

      return arrayMove(previousOrder, oldIndex, newIndex)
    })
  }

  function openCreateMetricDialog() {
    setIsCreateMetricDialogOpen(true)
    setCreateMetricStep("kind")
    setCreateMetricKind(null)
    setCreateMetricLabel("")
    setCreateMetricOptionsText("")
  }

  function openEditMetricDialog(item: SessionSetupDialogItem) {
    if (item.metricGroup !== "boat" || item.isFixed) {
      return
    }

    setEditingMetricId(item.id)
    setEditingMetricLabel(item.label)
    setEditingMetricKind(item.inputKind)
    setEditingMetricOptionsText(item.options.map((option) => option.label).join("\n"))
  }

  function renderField(item: SessionSetupDialogItem): React.ReactNode {
    const draft = draftByItemId[item.id] ?? {
      textValue: "",
      selectedOptions: [],
      twsEditedOptionIds: [],
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

    const selectedOptionIds = draft.selectedOptions.map((selectedOption) => selectedOption.optionId)

    return (
      <div className="space-y-2">
        <Multiselect
          value={selectedOptionIds}
          onValueChange={(nextValues) => updateSelectedOptionIds(item, nextValues)}
        >
          <MultiselectTrigger
            id={fieldId}
            placeholder={item.options.length > 0 ? "Select options" : "No options configured"}
            disabled={item.options.length === 0}
          >
            <MultiselectBadgeList>
              {selectedOptionIds.map((selectedId) => {
                const selectedOption = item.options.find((option) => option.id === selectedId)

                if (!selectedOption) {
                  return null
                }

                const selectedPercent =
                  item.key === "tws"
                    ? draft.selectedOptions.find(
                        (selectedOptionEntry) =>
                          selectedOptionEntry.optionId === selectedOption.id,
                      )?.allocationPercent
                    : null

                const badgeLabel =
                  item.key === "tws" && typeof selectedPercent === "number"
                    ? `${selectedOption.label} (${selectedPercent}%)`
                    : selectedOption.label

                return (
                  <MultiselectBadge key={selectedOption.id} value={selectedOption.id}>
                    {badgeLabel}
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

        {item.key === "tws" && draft.selectedOptions.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {draft.selectedOptions.map((selectedOption) => {
              const option = item.options.find(
                (optionRow) => optionRow.id === selectedOption.optionId,
              )

              if (!option) {
                return null
              }

              return (
                <label
                  key={selectedOption.optionId}
                  className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1"
                >
                  <span className="truncate text-xs text-muted-foreground">{option.label}</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      inputMode="numeric"
                      value={selectedOption.allocationPercent ?? 0}
                      onChange={(event) =>
                        updateTwsPercentValue(item, selectedOption.optionId, event.target.value)
                      }
                      className="h-7 w-20 text-right"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </label>
              )
            })}
          </div>
        ) : null}
      </div>
    )
  }

  function renderReadOnlyField(item: SessionSetupDialogItem): React.ReactNode {
    const draft = draftByItemId[item.id] ?? {
      textValue: "",
      selectedOptions: [],
      twsEditedOptionIds: [],
    }

    if (item.inputKind === "text") {
      const normalized = draft.textValue.trim()
      return (
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {normalized.length > 0 ? normalized : "—"}
        </p>
      )
    }

    const selectedLabels = draft.selectedOptions
      .map((selectedOption) => {
        const option = item.options.find((optionRow) => optionRow.id === selectedOption.optionId)

        if (!option) {
          return null
        }

        if (item.key === "tws" && typeof selectedOption.allocationPercent === "number") {
          return `${option.label} (${selectedOption.allocationPercent}%)`
        }

        return option.label
      })
      .filter((label): label is string => label !== null)

    if (selectedLabels.length === 0) {
      return <p className="text-sm text-muted-foreground">—</p>
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

  function renderEditableMetricRow(inputRow: {
    item: SessionSetupDialogItem
    showTemplateControls: boolean
    dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
    isDragging?: boolean
  }) {
    const hint = renderFieldHint(inputRow.item)

    return (
      <div
        key={inputRow.item.id}
        className={`rounded-lg border p-3 ${inputRow.isDragging ? "ring-1 ring-foreground/20" : ""}`}
      >
        <div className="flex items-center gap-3">
          <Label
            htmlFor={`setup-item-${inputRow.item.id}`}
            className="w-28 shrink-0 text-sm font-medium sm:w-36"
          >
            <span className="block truncate">{inputRow.item.label}</span>
          </Label>

          <div className="min-w-0 flex-1">{renderField(inputRow.item)}</div>

          {inputRow.showTemplateControls ? (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit setup metric ${inputRow.item.label}`}
                onClick={() => openEditMetricDialog(inputRow.item)}
              >
                <PencilIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete setup metric ${inputRow.item.label}`}
                onClick={() => setDeletingMetricId(inputRow.item.id)}
              >
                <Trash2Icon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Reorder setup metric ${inputRow.item.label}`}
                {...inputRow.dragHandleProps}
              >
                <GripVerticalIcon />
              </Button>
            </div>
          ) : null}
        </div>

        {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    )
  }

  function renderSection(title: string, children: React.ReactNode) {
    return (
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {children}
      </section>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Setup
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Session setup</DialogTitle>
        </DialogHeader>

        <form action={updateSessionSetupAction} className="space-y-4">
          <SetupScopeHiddenFields sessionId={input.sessionId} scope={input.scope} />
          <input type="hidden" name="setupPayload" value={payloadValue} />
          <input type="hidden" name="orderedItemIdsPayload" value={orderedItemIdsPayload} />

          <SetupDialogFieldset>
            <div className="no-scrollbar max-h-[65vh] space-y-6 overflow-y-auto pb-2 pr-1">
              {input.items.length === 0 ? (
                <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No setup metrics are configured for this team yet.
                </div>
              ) : (
                <>
                  {renderSection(
                    "Weather",
                    <div className="space-y-3">
                      {groupedItems.weather.map((item) =>
                        isEditMode ? (
                          renderEditableMetricRow({
                            item,
                            showTemplateControls: false,
                          })
                        ) : (
                          <div key={item.id} className="rounded-lg border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium">{item.label}</p>
                              <div className="min-w-0 flex-1 text-right">
                                {renderReadOnlyField(item)}
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>,
                  )}

                  {renderSection(
                    "Boat",
                    <div className="space-y-3">
                      {groupedItems.boat.length === 0 ? (
                        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                          No Boat metrics configured for this team yet.
                        </div>
                      ) : isEditMode ? (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleBoatDragEnd}
                        >
                          <SortableContext
                            items={boatOrderIds}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-3">
                              {orderedBoatItems.map((item) => (
                                <SortableBoatSetupRow key={item.id} itemId={item.id}>
                                  {({ dragHandleProps, isDragging }) =>
                                    renderEditableMetricRow({
                                      item,
                                      showTemplateControls: true,
                                      dragHandleProps,
                                      isDragging,
                                    })
                                  }
                                </SortableBoatSetupRow>
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      ) : (
                        <div className="space-y-3">
                          {groupedItems.boat.map((item) => (
                            <div key={item.id} className="rounded-lg border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-medium">{item.label}</p>
                                <div className="min-w-0 flex-1 text-right">
                                  {renderReadOnlyField(item)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>,
                  )}

                  {isEditMode ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed"
                      onClick={openCreateMetricDialog}
                    >
                      <PlusIcon className="size-4" />
                      Add new setup metric
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </SetupDialogFieldset>

          <SetupDialogFooter
            isEditMode={isEditMode}
            onEnterEditMode={() => setIsEditMode(true)}
          />
        </form>

        <Dialog
          open={isCreateMetricDialogOpen}
          onOpenChange={(nextOpen) => {
            setIsCreateMetricDialogOpen(nextOpen)
            if (!nextOpen) {
              setCreateMetricStep("kind")
              setCreateMetricKind(null)
              setCreateMetricLabel("")
              setCreateMetricOptionsText("")
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add setup metric</DialogTitle>
              <DialogDescription>
                Create a Boat metric. Weather definitions are fixed.
              </DialogDescription>
            </DialogHeader>

            {createMetricStep === "kind" ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Choose input kind</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateMetricKind("single_select")
                      setCreateMetricStep("details")
                    }}
                  >
                    Single Select
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateMetricKind("multi_select")
                      setCreateMetricStep("details")
                    }}
                  >
                    Multi Select
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateMetricKind("text")
                      setCreateMetricStep("details")
                    }}
                  >
                    Text
                  </Button>
                </div>
              </div>
            ) : (
              <form action={createTeamSetupMetricAction} className="space-y-4">
                <SetupScopeHiddenFields sessionId={input.sessionId} scope={input.scope} />
                <input type="hidden" name="inputKind" value={createMetricKind ?? "text"} />
                <input type="hidden" name="optionsPayload" value={createMetricOptionsPayload} />

                <div className="space-y-2">
                  <Label htmlFor="create-setup-metric-label">Metric name</Label>
                  <Input
                    id="create-setup-metric-label"
                    name="label"
                    value={createMetricLabel}
                    onChange={(event) => setCreateMetricLabel(event.target.value)}
                    placeholder="e.g. Mast bend"
                    maxLength={120}
                    required
                  />
                </div>

                {createMetricKind !== "text" ? (
                  <div className="space-y-2">
                    <Label htmlFor="create-setup-metric-options">Options (one per line)</Label>
                    <Textarea
                      id="create-setup-metric-options"
                      value={createMetricOptionsText}
                      onChange={(event) => setCreateMetricOptionsText(event.target.value)}
                      rows={6}
                      placeholder={"Option A\nOption B\nOption C"}
                    />
                  </div>
                ) : null}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateMetricStep("kind")
                      setCreateMetricKind(null)
                    }}
                  >
                    Back
                  </Button>
                  <Button type="submit">Create metric</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={editingMetric !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setEditingMetricId(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit setup metric</DialogTitle>
              <DialogDescription>
                Update Boat metric label, input kind, and options.
              </DialogDescription>
            </DialogHeader>

            <form action={updateTeamSetupMetricAction} className="space-y-4">
              <SetupScopeHiddenFields sessionId={input.sessionId} scope={input.scope} />
              <input type="hidden" name="itemId" value={editingMetric?.id ?? ""} />
              <input type="hidden" name="optionsPayload" value={updateMetricOptionsPayload} />

              <EditSetupMetricFieldset>
                <div className="space-y-2">
                  <Label htmlFor="edit-setup-metric-label">Metric name</Label>
                  <Input
                    id="edit-setup-metric-label"
                    name="label"
                    value={editingMetricLabel}
                    onChange={(event) => setEditingMetricLabel(event.target.value)}
                    maxLength={120}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-setup-metric-kind">Input kind</Label>
                  <select
                    id="edit-setup-metric-kind"
                    name="inputKind"
                    value={editingMetricKind}
                    onChange={(event) =>
                      setEditingMetricKind(
                        event.target.value as "single_select" | "multi_select" | "text",
                      )
                    }
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="single_select">Single Select</option>
                    <option value="multi_select">Multi Select</option>
                    <option value="text">Text</option>
                  </select>
                </div>

                {editingMetricKind !== "text" ? (
                  <div className="space-y-2">
                    <Label htmlFor="edit-setup-metric-options">Options (one per line)</Label>
                    <Textarea
                      id="edit-setup-metric-options"
                      value={editingMetricOptionsText}
                      onChange={(event) => setEditingMetricOptionsText(event.target.value)}
                      rows={6}
                      placeholder={"Option A\nOption B\nOption C"}
                    />
                  </div>
                ) : null}

                <DialogFooter>
                  <EditSetupMetricSubmitButton />
                </DialogFooter>
              </EditSetupMetricFieldset>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={deletingMetric !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setDeletingMetricId(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete setup metric</DialogTitle>
              <DialogDescription>
                This hides the metric for future setup entries and keeps historical session data.
              </DialogDescription>
            </DialogHeader>

            <p className="text-sm">
              Delete <span className="font-semibold">{deletingMetric?.label ?? "this metric"}</span>?
            </p>

            <form action={deleteTeamSetupMetricAction} className="space-y-4">
              <SetupScopeHiddenFields sessionId={input.sessionId} scope={input.scope} />
              <input type="hidden" name="itemId" value={deletingMetric?.id ?? ""} />

              <DialogFooter>
                <Button type="submit" variant="destructive">
                  Delete metric
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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

type InfoEditSection = "coaching" | "standardMoves" | "windPatterns"

function resolveInfoEditCopy(section: InfoEditSection): {
  triggerLabel: string
  title: string
  description: string
  submitLabel: string
} {
  if (section === "coaching") {
    return {
      triggerLabel: "Edit",
      title: "Edit Coaching Notes",
      description: "",
      submitLabel: "Save",
    }
  }

  if (section === "standardMoves") {
    return {
      triggerLabel: "Edit",
      title: "Edit Standard Moves",
      description: "",
      submitLabel: "Save",
    }
  }

  return {
    triggerLabel: "Edit",
    title: "Edit Wind Patterns",
    description: "",
    submitLabel: "Save",
  }
}

function InfoDialogSubmitButton(props: {
  canSubmit: boolean
  className?: string
  label: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending || !props.canSubmit} className={props.className}>
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          Saving...
        </>
      ) : (
        props.label
      )}
    </Button>
  )
}

function InfoDialogFieldset(props: { children: React.ReactNode }) {
  const { pending } = useFormStatus()

  return (
    <fieldset disabled={pending} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
      {props.children}
    </fieldset>
  )
}

function NoteCorrectButton(props: {
  value: string
  onCorrect: (correctedValue: string) => void
}) {
  const correctedValue = correctSessionNoteText(props.value)
  const canCorrect = correctedValue.length > 0 && correctedValue !== props.value

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={!canCorrect}
      onClick={() => props.onCorrect(correctedValue)}
    >
      <SpellCheckIcon className="size-4" />
      Correct
    </Button>
  )
}

function InfoEditDialog(input: {
  section: InfoEditSection
  sessionId: string
  scope: NavigationScope
  bestOfSession: string | null
  toWork: string | null
  availableStandardMoves: {
    id: string
    name: string
    description: string | null
    isActive: boolean
  }[]
  linkedStandardMoveIds: string[]
  windPatterns: string | null
  freeNotes: string | null
}) {
  const [bestOfSession, setBestOfSession] = React.useState(input.bestOfSession ?? "")
  const [toWork, setToWork] = React.useState(input.toWork ?? "")
  const [standardMoveIds, setStandardMoveIds] = React.useState<string[]>(input.linkedStandardMoveIds)
  const [newStandardMoveName, setNewStandardMoveName] = React.useState("")
  const [newStandardMoveDescription, setNewStandardMoveDescription] = React.useState("")
  const [isQuickCreateDialogOpen, setIsQuickCreateDialogOpen] = React.useState(false)
  const [isQuickCreateNameManuallyEdited, setIsQuickCreateNameManuallyEdited] =
    React.useState(false)
  const [windPatterns, setWindPatterns] = React.useState(input.windPatterns ?? "")
  const [freeNotes, setFreeNotes] = React.useState(input.freeNotes ?? "")
  const isMobile = useIsMobile()
  const hasQuickCreateName = newStandardMoveName.trim().length > 0
  const hasQuickCreateDescription = newStandardMoveDescription.trim().length > 0
  const quickCreateDescriptionMissing = hasQuickCreateName && !hasQuickCreateDescription
  const standardMoveOptions = input.availableStandardMoves.filter(
    (standardMove) =>
      standardMove.isActive || input.linkedStandardMoveIds.includes(standardMove.id),
  )
  const copy = resolveInfoEditCopy(input.section)
  const canSubmitInfo =
    input.section === "standardMoves" ? !quickCreateDescriptionMissing : true

  const infoForm = (
    <form action={updateSessionInfoAction} className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="sessionId" value={input.sessionId} />
      <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
      {input.scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
      ) : null}
      <input type="hidden" name="scopeTab" value="info" />
      <input type="hidden" name="newStandardMoveName" value={newStandardMoveName} />
      <input
        type="hidden"
        name="newStandardMoveDescription"
        value={newStandardMoveDescription}
      />
      {input.section !== "coaching" ? (
        <>
          <input type="hidden" name="bestOfSession" value={bestOfSession} />
          <input type="hidden" name="toWork" value={toWork} />
          <input type="hidden" name="freeNotes" value={freeNotes} />
        </>
      ) : null}
      {input.section !== "standardMoves"
        ? standardMoveIds.map((standardMoveId) => (
            <input
              key={standardMoveId}
              type="hidden"
              name="standardMoveId"
              value={standardMoveId}
            />
          ))
        : null}
      {input.section !== "windPatterns" ? (
        <input type="hidden" name="windPatterns" value={windPatterns} />
      ) : null}

      <InfoDialogFieldset>
        {input.section === "coaching" ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`best-of-session-${input.sessionId}`}>Best</Label>
                <NoteCorrectButton value={bestOfSession} onCorrect={setBestOfSession} />
              </div>
              <Textarea
                id={`best-of-session-${input.sessionId}`}
                name="bestOfSession"
                rows={3}
                maxLength={4000}
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck
                value={bestOfSession}
                onChange={(event) => setBestOfSession(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`to-work-${input.sessionId}`}>To Work</Label>
                <NoteCorrectButton value={toWork} onCorrect={setToWork} />
              </div>
              <Textarea
                id={`to-work-${input.sessionId}`}
                name="toWork"
                rows={3}
                maxLength={4000}
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck
                value={toWork}
                onChange={(event) => setToWork(event.target.value)}
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
          </>
        ) : null}

        {input.section === "standardMoves" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor={`standard-moves-${input.sessionId}`}>Std. Moves</Label>
              <select
                id={`standard-moves-${input.sessionId}`}
                multiple
                name="standardMoveId"
                value={standardMoveIds}
                onChange={(event) => {
                  const nextSelectedIds = Array.from(event.target.selectedOptions).map(
                    (option) => option.value,
                  )
                  setStandardMoveIds(nextSelectedIds)
                }}
                className="min-h-32 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/50 focus-visible:ring-[3px]"
              >
                {standardMoveOptions.length === 0 ? (
                  <option value="" disabled>
                    No standard moves available yet.
                  </option>
                ) : (
                  standardMoveOptions.map((standardMove) => (
                    <option key={standardMove.id} value={standardMove.id}>
                      {standardMove.name}
                      {standardMove.isActive ? "" : " (Archived)"}
                    </option>
                  ))
                )}
              </select>
              <p className="text-xs text-muted-foreground">
                Hold Cmd/Ctrl to select multiple moves.
              </p>
            </div>

            <div className="grid gap-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Quick Create Std. Move</p>
                  <p className="text-xs text-muted-foreground">
                    Create and link a new team standard move without leaving this screen.
                  </p>
                </div>
                <Dialog open={isQuickCreateDialogOpen} onOpenChange={setIsQuickCreateDialogOpen}>
                  <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
                    <PlusIcon className="size-4" />
                    Quick create
                  </DialogTrigger>
                  <DialogContent
                    className="sm:max-w-xl"
                    overlayClassName="bg-black/35 backdrop-blur-md"
                  >
                    <DialogHeader>
                      <DialogTitle>Quick Create Std. Move</DialogTitle>
                      <DialogDescription>
                        Description is required. Name is auto-generated and editable.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`quick-standard-move-description-${input.sessionId}`}>
                          Description
                        </Label>
                        <Textarea
                          id={`quick-standard-move-description-${input.sessionId}`}
                          rows={3}
                          maxLength={4000}
                          value={newStandardMoveDescription}
                          onChange={(event) => {
                            const nextDescription = event.target.value
                            setNewStandardMoveDescription(nextDescription)

                            if (!isQuickCreateNameManuallyEdited) {
                              if (nextDescription.trim().length === 0) {
                                setNewStandardMoveName("")
                              } else {
                                setNewStandardMoveName(
                                  generateStandardMoveNameFromDescription(nextDescription),
                                )
                              }
                            }
                          }}
                          placeholder="Describe the move in plain language."
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`quick-standard-move-name-${input.sessionId}`}>Name</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={newStandardMoveDescription.trim().length === 0}
                            onClick={() => {
                              setNewStandardMoveName(
                                generateStandardMoveNameFromDescription(newStandardMoveDescription),
                              )
                              setIsQuickCreateNameManuallyEdited(false)
                            }}
                          >
                            Use generated
                          </Button>
                        </div>
                        <Input
                          id={`quick-standard-move-name-${input.sessionId}`}
                          maxLength={120}
                          value={newStandardMoveName}
                          onChange={(event) => {
                            setNewStandardMoveName(event.target.value)
                            setIsQuickCreateNameManuallyEdited(true)
                          }}
                          placeholder="Auto-generated from the description"
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsQuickCreateDialogOpen(false)}
                      >
                        Done
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {hasQuickCreateDescription ? (
                <p className="text-xs text-muted-foreground">
                  Will create and link:{" "}
                  <span className="font-medium text-foreground">
                    {newStandardMoveName.trim().length > 0
                      ? newStandardMoveName.trim()
                      : generateStandardMoveNameFromDescription(newStandardMoveDescription)}
                  </span>
                </p>
              ) : null}

              {quickCreateDescriptionMissing ? (
                <p className="text-xs text-destructive">
                  Description is required when quick-creating a standard move.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {input.section === "windPatterns" ? (
          <div className="space-y-2">
            <Label htmlFor={`wind-patterns-${input.sessionId}`}>Wind Patterns</Label>
            <Textarea
              id={`wind-patterns-${input.sessionId}`}
              name="windPatterns"
              rows={6}
              maxLength={4000}
              value={windPatterns}
              onChange={(event) => setWindPatterns(event.target.value)}
              placeholder="Plain text or JSON"
            />
          </div>
        ) : null}
      </InfoDialogFieldset>

      {isMobile ? (
        <DrawerFooter className="shrink-0">
          <InfoDialogSubmitButton
            canSubmit={canSubmitInfo}
            className="w-full"
            label={copy.submitLabel}
          />
        </DrawerFooter>
      ) : (
        <SheetFooter className="shrink-0">
          <InfoDialogSubmitButton
            canSubmit={canSubmitInfo}
            className="w-full"
            label={copy.submitLabel}
          />
        </SheetFooter>
      )}
    </form>
  )
  const surfaceClassName = [
    "transition-[filter] duration-100",
    isQuickCreateDialogOpen ? "blur-[2px]" : "",
  ].join(" ")

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <Button type="button" variant="outline" size="default" className="h-9 px-3">
            {copy.triggerLabel}
          </Button>
        </DrawerTrigger>
        <DrawerContent
          className={`h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh] ${surfaceClassName}`}
        >
          <DrawerHeader className="shrink-0">
            <DrawerTitle>{copy.title}</DrawerTitle>
            <DrawerDescription>{copy.description}</DrawerDescription>
          </DrawerHeader>
          {infoForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
        {copy.triggerLabel}
      </SheetTrigger>
      <SheetContent side="right" className={`h-full overflow-hidden sm:max-w-2xl ${surfaceClassName}`}>
        <SheetHeader className="shrink-0">
          <SheetTitle>{copy.title}</SheetTitle>
          <SheetDescription>{copy.description}</SheetDescription>
        </SheetHeader>

        {infoForm}
      </SheetContent>
    </Sheet>
  )
}

function GoalsEditDialog(input: {
  sessionId: string
  scope: NavigationScope
  goals: string | null
}) {
  function GoalsDialogFieldset(props: { children: React.ReactNode }) {
    const { pending } = useFormStatus()

    return <fieldset disabled={pending}>{props.children}</fieldset>
  }

  function GoalsDialogSubmitButton() {
    const { pending } = useFormStatus()

    return (
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Saving goals...
          </>
        ) : (
          "Save goals"
        )}
      </Button>
    )
  }

  const [goals, setGoals] = React.useState(input.goals ?? "")

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Edit goals
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit session goals</DialogTitle>
          <DialogDescription>
            Update the goals and execution focus for this session.
          </DialogDescription>
        </DialogHeader>

        <form action={updateSessionGoalsAction} className="space-y-4">
          <input type="hidden" name="sessionId" value={input.sessionId} />
          <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
          {input.scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
          ) : null}
          <input type="hidden" name="scopeTab" value="goals" />

          <GoalsDialogFieldset>
            <div className="space-y-2">
              <Label htmlFor={`session-goals-${input.sessionId}`}>Goals</Label>
              <Textarea
                id={`session-goals-${input.sessionId}`}
                name="goals"
                rows={12}
                maxLength={4000}
                value={goals}
                onChange={(event) => setGoals(event.target.value)}
                placeholder="Write session goals, priorities, and execution focus..."
              />
              <p className="text-xs text-muted-foreground">{goals.length}/4000</p>
            </div>
          </GoalsDialogFieldset>

          <DialogFooter>
            <GoalsDialogSubmitButton />
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
    standardMoves: string[]
    windPatterns: string | null
    freeNotes: string | null
  }
  goals: string | null
  availableStandardMoves: {
    id: string
    name: string
    description: string | null
    isActive: boolean
  }[]
  linkedStandardMoveIds: string[]
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
        {selectedTab === "info" ? (
        <TabsContent value="info" className="space-y-4">
          <div className="space-y-4">
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold">Coaching Notes</h4>
                </div>
                {input.canManageSession ? (
                  <InfoEditDialog
                    section="coaching"
                    sessionId={input.sessionId}
                    scope={input.scope}
                    bestOfSession={input.info.bestOfSession}
                    toWork={input.info.toWork}
                    availableStandardMoves={input.availableStandardMoves}
                    linkedStandardMoveIds={input.linkedStandardMoveIds}
                    windPatterns={input.info.windPatterns}
                    freeNotes={input.info.freeNotes}
                  />
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Best
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {renderTextValue(input.info.bestOfSession)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    To Work
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {renderTextValue(input.info.toWork)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-4 sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Free Notes
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {renderTextValue(input.info.freeNotes)}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold">Standard Moves</h4>
                </div>
                {input.canManageSession ? (
                  <InfoEditDialog
                    section="standardMoves"
                    sessionId={input.sessionId}
                    scope={input.scope}
                    bestOfSession={input.info.bestOfSession}
                    toWork={input.info.toWork}
                    availableStandardMoves={input.availableStandardMoves}
                    linkedStandardMoveIds={input.linkedStandardMoveIds}
                    windPatterns={input.info.windPatterns}
                    freeNotes={input.info.freeNotes}
                  />
                ) : null}
              </div>

              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Std. Moves
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {renderTextList(input.info.standardMoves)}
                </p>
              </div>
            </section>

            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold">Wind Patterns</h4>
                </div>
                {input.canManageSession ? (
                  <InfoEditDialog
                    section="windPatterns"
                    sessionId={input.sessionId}
                    scope={input.scope}
                    bestOfSession={input.info.bestOfSession}
                    toWork={input.info.toWork}
                    availableStandardMoves={input.availableStandardMoves}
                    linkedStandardMoveIds={input.linkedStandardMoveIds}
                    windPatterns={input.info.windPatterns}
                    freeNotes={input.info.freeNotes}
                  />
                ) : null}
              </div>

              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Wind Patterns
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {renderTextValue(input.info.windPatterns)}
                </p>
              </div>
            </section>
          </div>
        </TabsContent>
        ) : null}

        {selectedTab === "goals" ? (
        <TabsContent value="goals" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Goals</h3>
              <p className="text-sm text-muted-foreground">
                Session-level goals and priorities for the crew.
              </p>
            </div>
            {input.canManageSession ? (
              <GoalsEditDialog
                sessionId={input.sessionId}
                scope={input.scope}
                goals={input.goals}
              />
            ) : null}
          </div>

          <div className="rounded-lg border p-4">
            {input.goals && input.goals.trim().length > 0 ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{input.goals}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No goals set for this session yet.</p>
            )}
          </div>
        </TabsContent>
        ) : null}

        {selectedTab === "results" ? (
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
        ) : null}

        {selectedTab === "images" ? (
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
        ) : null}

        {selectedTab === "analytics" ? (
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
        ) : null}

        {selectedTab === "gear" ? (
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
        ) : null}
      </section>
    </Tabs>
  )
}
