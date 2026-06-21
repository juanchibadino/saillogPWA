"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  GripVerticalIcon,
  Loader2Icon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
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
import { toast } from "sonner"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  createSessionStandardMoveAction,
  createTeamSetupMetricAction,
  deleteTeamSetupMetricAction,
  saveSessionSetupAction,
  saveSessionInfoAction,
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
import { cn } from "@/lib/utils"

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

const SESSION_DURATION_STEP_MINUTES = 15
const MIN_SESSION_DURATION_MINUTES = SESSION_DURATION_STEP_MINUTES
const DEFAULT_SESSION_DURATION_MINUTES = 60
const MAX_SESSION_DURATION_MINUTES = 24 * 60

function clampSessionDurationMinutes(minutes: number): number {
  return Math.min(Math.max(minutes, MIN_SESSION_DURATION_MINUTES), MAX_SESSION_DURATION_MINUTES)
}

function resolveSessionDurationMinutes(input: {
  dockOutAt: string | null
  dockInAt: string | null
  fallbackNetTimeMinutes: number | null
}): number {
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
    return DEFAULT_SESSION_DURATION_MINUTES
  }

  const roundedMinutes =
    Math.round(minutes / SESSION_DURATION_STEP_MINUTES) * SESSION_DURATION_STEP_MINUTES

  return clampSessionDurationMinutes(roundedMinutes)
}

function formatSessionDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours <= 0) {
    return `${remainingMinutes}m`
  }

  return `${hours}h ${remainingMinutes}m`
}

function formatSessionDurationHoursValue(minutes: number): string {
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

type SetupPayloadEntry = {
  itemId: string
  textValue: string | null
  selectedOptions: SetupDraftSelectedOption[]
}

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

function buildBoatSetupOrderIds(items: SessionSetupDialogItem[]): string[] {
  return groupSetupItems(items).boat.map((item) => item.id)
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function normalizeSetupTextValue(value: string): string | null {
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeSetupSelectedOptions(input: {
  item: SessionSetupDialogItem
  selectedOptions: SetupDraftSelectedOption[]
}): SetupDraftSelectedOption[] {
  const optionOrderById = new Map(
    input.item.options.map((option, index) => [option.id, index]),
  )
  const selectedOptionById = new Map(
    input.selectedOptions.map((selectedOption) => [
      selectedOption.optionId,
      selectedOption,
    ]),
  )

  return [...selectedOptionById.values()]
    .sort(
      (left, right) =>
        (optionOrderById.get(left.optionId) ?? Number.MAX_SAFE_INTEGER) -
        (optionOrderById.get(right.optionId) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((selectedOption) => ({
      optionId: selectedOption.optionId,
      allocationPercent:
        input.item.key === "tws" && typeof selectedOption.allocationPercent === "number"
          ? clampPercentInteger(selectedOption.allocationPercent)
          : null,
    }))
}

function buildSetupPayloadEntryFromDraft(input: {
  item: SessionSetupDialogItem
  draftByItemId: SetupDraftByItemId
}): SetupPayloadEntry {
  const draft = input.draftByItemId[input.item.id] ?? {
    textValue: "",
    selectedOptions: [],
    twsEditedOptionIds: [],
  }

  return {
    itemId: input.item.id,
    textValue:
      input.item.inputKind === "text" ? normalizeSetupTextValue(draft.textValue) : null,
    selectedOptions:
      input.item.inputKind === "text"
        ? []
        : normalizeSetupSelectedOptions({
            item: input.item,
            selectedOptions: draft.selectedOptions,
          }),
  }
}

function buildSetupPayloadEntryFromItem(item: SessionSetupDialogItem): SetupPayloadEntry {
  return {
    itemId: item.id,
    textValue: item.inputKind === "text" ? normalizeSetupTextValue(item.textValue) : null,
    selectedOptions:
      item.inputKind === "text"
        ? []
        : normalizeSetupSelectedOptions({
            item,
            selectedOptions: item.selectedOptions,
          }),
  }
}

function areSetupPayloadEntriesEqual(left: SetupPayloadEntry, right: SetupPayloadEntry): boolean {
  return (
    left.textValue === right.textValue &&
    left.selectedOptions.length === right.selectedOptions.length &&
    left.selectedOptions.every((leftOption, index) => {
      const rightOption = right.selectedOptions[index]
      return (
        rightOption &&
        leftOption.optionId === rightOption.optionId &&
        leftOption.allocationPercent === rightOption.allocationPercent
      )
    })
  )
}

function buildChangedSetupPayloadEntries(input: {
  items: SessionSetupDialogItem[]
  draftByItemId: SetupDraftByItemId
}): SetupPayloadEntry[] {
  return input.items
    .map((item) => ({
      currentEntry: buildSetupPayloadEntryFromItem(item),
      nextEntry: buildSetupPayloadEntryFromDraft({
        item,
        draftByItemId: input.draftByItemId,
      }),
    }))
    .filter(
      ({ currentEntry, nextEntry }) =>
        !areSetupPayloadEntriesEqual(currentEntry, nextEntry),
    )
    .map(({ nextEntry }) => nextEntry)
}

function buildOptimisticSetupItems(input: {
  items: SessionSetupDialogItem[]
  draftByItemId: SetupDraftByItemId
  boatOrderIds: string[]
}): SessionSetupDialogItem[] {
  const boatPositionById = new Map(
    input.boatOrderIds.map((itemId, index) => [itemId, index + 1]),
  )

  return input.items.map((item) => {
    const nextEntry = buildSetupPayloadEntryFromDraft({
      item,
      draftByItemId: input.draftByItemId,
    })

    return {
      ...item,
      position:
        item.metricGroup === "boat"
          ? (boatPositionById.get(item.id) ?? item.position)
          : item.position,
      textValue: item.inputKind === "text" ? (nextEntry.textValue ?? "") : "",
      selectedOptions: item.inputKind === "text" ? [] : nextEntry.selectedOptions,
    }
  })
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
  isSaving: boolean
  onEnterEditMode: () => void
  surface: "drawer" | "sheet"
}) {
  const { pending } = useFormStatus()
  const isPending = pending || input.isSaving

  const content = (
    <>
      {!input.isEditMode ? (
        <Button
          key="setup-edit"
          type="button"
          variant="outline"
          size="sm"
          className={input.surface === "drawer" ? "w-full" : undefined}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            input.onEnterEditMode()
          }}
          disabled={isPending}
        >
          Edit
        </Button>
      ) : (
        <Button
          key="setup-save"
          type="submit"
          disabled={isPending}
          className={input.surface === "drawer" ? "w-full" : undefined}
        >
          {isPending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
      )}
    </>
  )

  if (input.surface === "drawer") {
    return <DrawerFooter className="shrink-0 border-t">{content}</DrawerFooter>
  }

  return (
    <SheetFooter
      className={input.isEditMode ? "shrink-0 border-t sm:justify-end" : "shrink-0 border-t sm:justify-start"}
    >
      {content}
    </SheetFooter>
  )
}

function SetupDialog(input: {
  sessionId: string
  scope: NavigationScope
  items: SessionSetupDialogItem[]
}) {
  function SetupDialogFieldset(props: { children: React.ReactNode; isSaving: boolean }) {
    const { pending } = useFormStatus()

    return (
      <fieldset
        disabled={pending || props.isSaving}
        className="m-0 min-h-0 flex-1 overflow-hidden border-0 p-0"
      >
        {props.children}
      </fieldset>
    )
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

  const [setupItems, setSetupItems] = React.useState<SessionSetupDialogItem[]>(input.items)
  const groupedItems = React.useMemo(() => groupSetupItems(setupItems), [setupItems])
  const initialBoatOrderIds = React.useMemo(
    () => buildBoatSetupOrderIds(setupItems),
    [setupItems],
  )
  const boatItemById = React.useMemo(
    () => new Map(groupedItems.boat.map((item) => [item.id, item])),
    [groupedItems.boat],
  )

  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)
  const [isEditMode, setIsEditMode] = React.useState(false)
  const [draftByItemId, setDraftByItemId] = React.useState<SetupDraftByItemId>(() =>
    buildInitialSetupDraft(input.items),
  )
  const [boatOrderIds, setBoatOrderIds] = React.useState<string[]>(initialBoatOrderIds)
  const [isSavingSetup, setIsSavingSetup] = React.useState(false)
  const previousInputItemsRef = React.useRef(input.items)

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
  const isMobile = useIsMobile()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  React.useEffect(() => {
    if (previousInputItemsRef.current === input.items) {
      return
    }

    previousInputItemsRef.current = input.items
    setSetupItems(input.items)

    if (!isOpen || !isEditMode) {
      setDraftByItemId(buildInitialSetupDraft(input.items))
      setBoatOrderIds(buildBoatSetupOrderIds(input.items))
    }
  }, [input.items, isEditMode, isOpen])

  const setupPayloadEntries = React.useMemo(
    () =>
      buildChangedSetupPayloadEntries({
        items: setupItems,
        draftByItemId,
      }),
    [draftByItemId, setupItems],
  )

  const payloadValue = React.useMemo(
    () => JSON.stringify(setupPayloadEntries),
    [setupPayloadEntries],
  )

  const hasBoatOrderChange = React.useMemo(
    () => !areStringArraysEqual(boatOrderIds, buildBoatSetupOrderIds(setupItems)),
    [boatOrderIds, setupItems],
  )

  const orderedItemIdsPayload = React.useMemo(
    () => (hasBoatOrderChange ? JSON.stringify(boatOrderIds) : null),
    [boatOrderIds, hasBoatOrderChange],
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
    setDraftByItemId(buildInitialSetupDraft(setupItems))
    setBoatOrderIds(buildBoatSetupOrderIds(setupItems))
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

  async function handleSetupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isEditMode || isSavingSetup) {
      return
    }

    if (setupPayloadEntries.length === 0 && !orderedItemIdsPayload) {
      setIsEditMode(false)
      setIsOpen(false)
      return
    }

    const formData = new FormData(event.currentTarget)
    const previousSetupItems = setupItems
    const submittedDraftByItemId = draftByItemId
    const submittedBoatOrderIds = boatOrderIds
    const optimisticSetupItems = buildOptimisticSetupItems({
      items: setupItems,
      draftByItemId,
      boatOrderIds,
    })
    const toastId = `session-setup-save:${input.sessionId}`

    setSetupItems(optimisticSetupItems)
    setDraftByItemId(buildInitialSetupDraft(optimisticSetupItems))
    setBoatOrderIds(buildBoatSetupOrderIds(optimisticSetupItems))
    setIsEditMode(false)
    setIsOpen(false)
    setIsSavingSetup(true)

    try {
      const result = await saveSessionSetupAction(formData)

      if (!result.ok) {
        setSetupItems(previousSetupItems)
        setDraftByItemId(submittedDraftByItemId)
        setBoatOrderIds(submittedBoatOrderIds)
        setIsEditMode(true)
        setIsOpen(true)
        toast.error(result.message, { id: toastId })
        return
      }

      toast.success("Session setup updated successfully.", { id: toastId })
      router.refresh()
    } catch {
      setSetupItems(previousSetupItems)
      setDraftByItemId(submittedDraftByItemId)
      setBoatOrderIds(submittedBoatOrderIds)
      setIsEditMode(true)
      setIsOpen(true)
      toast.error("Could not update this session setup. Confirm permissions and try again.", {
        id: toastId,
      })
    } finally {
      setIsSavingSetup(false)
    }
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
        className={`space-y-3 rounded-lg ${inputRow.isDragging ? "ring-1 ring-foreground/20" : ""}`}
      >
        <div className="flex items-center justify-between gap-3">
          <Label
            htmlFor={`setup-item-${inputRow.item.id}`}
            className="min-w-0 text-xs uppercase text-muted-foreground"
          >
            <span className="block truncate">{inputRow.item.label}</span>
          </Label>

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

        <div className="min-w-0">{renderField(inputRow.item)}</div>

        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
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

  const setupForm = (
    <form
      action={updateSessionSetupAction}
      onSubmit={handleSetupSubmit}
      className="flex min-h-0 flex-1 flex-col"
    >
          <SetupScopeHiddenFields sessionId={input.sessionId} scope={input.scope} />
          <input type="hidden" name="setupPayload" value={payloadValue} />
          {orderedItemIdsPayload ? (
            <input
              type="hidden"
              name="orderedItemIdsPayload"
              value={orderedItemIdsPayload}
            />
          ) : null}

          <SetupDialogFieldset isSaving={isSavingSetup}>
            <div className="no-scrollbar h-full space-y-6 overflow-y-auto px-4 pb-4 pr-5">
              {setupItems.length === 0 ? (
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
            isSaving={isSavingSetup}
            onEnterEditMode={() => setIsEditMode(true)}
            surface={isMobile ? "drawer" : "sheet"}
          />
        </form>
  )

  const setupSurface = isMobile ? (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button type="button" variant="outline" size="default" className="h-9 px-3">
          Setup
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Session setup</DrawerTitle>
        </DrawerHeader>
        {setupForm}
      </DrawerContent>
    </Drawer>
  ) : (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Setup
      </SheetTrigger>
      <SheetContent side="right" className="h-full overflow-hidden sm:max-w-5xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>Session setup</SheetTitle>
        </SheetHeader>
        {setupForm}
      </SheetContent>
    </Sheet>
  )

  return (
    <>
      {setupSurface}

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
    </>
  )
}

export function SessionMetadataEditAction(input: {
  sessionId: string
  scope: NavigationScope
  sessionType: "training" | "regatta"
  sessionDate: string
  dockOutAt: string | null
  dockInAt: string | null
  netTimeMinutes: number | null
}) {
  function EditSessionDialogSubmitButton(props: { className?: string }) {
    const { pending } = useFormStatus()

    return (
      <Button type="submit" disabled={pending} className={props.className}>
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
  const [nextTotalDurationMinutes, setNextTotalDurationMinutes] = React.useState(() =>
    resolveSessionDurationMinutes({
      dockOutAt: input.dockOutAt,
      dockInAt: input.dockInAt,
      fallbackNetTimeMinutes: input.netTimeMinutes,
    }),
  )
  const isMobile = useIsMobile()
  const totalDurationLabelId = `session-duration-label-${input.sessionId}`
  const nextTotalDurationHours = formatSessionDurationHoursValue(nextTotalDurationMinutes)

  function adjustTotalDurationMinutes(deltaMinutes: number): void {
    setNextTotalDurationMinutes((currentMinutes) =>
      clampSessionDurationMinutes(currentMinutes + deltaMinutes),
    )
  }

  const editSessionForm = (
    <form
      action={updateSessionDetailAction}
      className={cn("flex min-h-0 flex-col", isMobile ? "flex-none" : "flex-1")}
    >
      <input type="hidden" name="id" value={input.sessionId} />
      <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
      {input.scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
      ) : null}
      <input type="hidden" name="scopeTab" value="info" />

      <div
        className={cn(
          "overflow-y-auto px-4 pb-4",
          isMobile ? "max-h-[calc(85dvh-10rem)]" : "min-h-0 flex-1",
        )}
      >
        <div className="space-y-4">
          <EditSessionDialogFieldset>
            <div className="space-y-4">
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
                  required
                  value={nextStartTime}
                  onChange={(event) => setNextStartTime(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label id={totalDurationLabelId}>Total Duration</Label>
                <input type="hidden" name="totalDurationHours" value={nextTotalDurationHours} />
                <div
                  className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2"
                  role="group"
                  aria-labelledby={totalDurationLabelId}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className="size-12"
                    aria-label="Decrease total duration by 15 minutes"
                    disabled={nextTotalDurationMinutes <= MIN_SESSION_DURATION_MINUTES}
                    onClick={() => adjustTotalDurationMinutes(-SESSION_DURATION_STEP_MINUTES)}
                  >
                    <MinusIcon className="size-5" />
                  </Button>
                  <div
                    className="flex h-12 min-w-0 items-center justify-center rounded-lg border border-input bg-background px-3 text-base font-medium tabular-nums"
                    aria-live="polite"
                  >
                    {formatSessionDurationLabel(nextTotalDurationMinutes)}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className="size-12"
                    aria-label="Increase total duration by 15 minutes"
                    disabled={nextTotalDurationMinutes >= MAX_SESSION_DURATION_MINUTES}
                    onClick={() => adjustTotalDurationMinutes(SESSION_DURATION_STEP_MINUTES)}
                  >
                    <PlusIcon className="size-5" />
                  </Button>
                </div>
              </div>
            </div>
          </EditSessionDialogFieldset>
        </div>
      </div>

      {isMobile ? (
        <DrawerFooter className="shrink-0 border-t">
          <EditSessionDialogSubmitButton className="w-full" />
        </DrawerFooter>
      ) : (
        <SheetFooter className="shrink-0 border-t">
          <EditSessionDialogSubmitButton className="w-full" />
        </SheetFooter>
      )}
    </form>
  )

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Edit session"
          >
            <PencilIcon className="size-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Edit Session</DrawerTitle>
          </DrawerHeader>
          {editSessionForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Edit session"
          />
        }
      >
        <PencilIcon className="size-4" />
      </SheetTrigger>
      <SheetContent side="right" className="h-full overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>Edit Session</SheetTitle>
        </SheetHeader>
        {editSessionForm}
      </SheetContent>
    </Sheet>
  )
}

type InfoEditSection = "coaching" | "standardMoves" | "windPatterns"

type SessionInfoState = {
  bestOfSession: string | null
  toWork: string | null
  standardMoves: string[]
  windPatterns: string | null
  freeNotes: string | null
}

type SessionInfoStandardMove = {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

function resolveLinkedStandardMoveBadges(input: {
  availableStandardMoves: SessionInfoStandardMove[]
  linkedStandardMoveIds: string[]
  fallbackStandardMoveNames: string[]
}): SessionInfoStandardMove[] {
  const standardMoveById = new Map(
    input.availableStandardMoves.map((standardMove) => [standardMove.id, standardMove]),
  )
  const linkedStandardMoves = input.linkedStandardMoveIds
    .map((standardMoveId) => standardMoveById.get(standardMoveId) ?? null)
    .filter((standardMove): standardMove is SessionInfoStandardMove => standardMove !== null)

  if (linkedStandardMoves.length > 0) {
    return linkedStandardMoves.sort((left, right) => left.name.localeCompare(right.name))
  }

  return input.fallbackStandardMoveNames.map((name, index) => ({
    id: `fallback-${index}-${name}`,
    name,
    description: null,
    isActive: true,
  }))
}

function StandardMoveTooltipBadge(props: {
  standardMove: SessionInfoStandardMove
  isMobile: boolean
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const description = props.standardMove.description?.trim()
  const tooltipText =
    description && description.length > 0 ? description : "No description available."

  return (
    <Tooltip open={isOpen} onOpenChange={setIsOpen}>
      <TooltipTrigger
        closeOnClick={false}
        className="max-w-full rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={(event) => {
          if (!props.isMobile) {
            return
          }

          event.preventDefault()
          setIsOpen((currentIsOpen) => !currentIsOpen)
        }}
      >
        <Badge
          variant="secondary"
          className={[
            "h-7 max-w-full rounded-md border border-border/70 bg-background px-2.5 text-foreground hover:bg-accent",
            props.isMobile ? "cursor-pointer" : "cursor-help",
          ].join(" ")}
        >
          <span className="max-w-[16rem] truncate">{props.standardMove.name}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm whitespace-normal text-left leading-relaxed">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function SessionInfoStandardMovesBadges(input: {
  availableStandardMoves: SessionInfoStandardMove[]
  linkedStandardMoveIds: string[]
  fallbackStandardMoveNames: string[]
}) {
  const isMobile = useIsMobile()
  const standardMoves = resolveLinkedStandardMoveBadges(input)

  if (standardMoves.length === 0) {
    return <p className="mt-2 whitespace-pre-wrap text-sm">—</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {standardMoves.map((standardMove) => (
        <StandardMoveTooltipBadge
          key={standardMove.id}
          standardMove={standardMove}
          isMobile={isMobile}
        />
      ))}
    </div>
  )
}

type SessionInfoSaveDraft = {
  bestOfSession: string
  toWork: string
  freeNotes: string
  windPatterns: string
  standardMoveIds: string[]
}

function normalizeInfoText(value: string): string | null {
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function buildOptimisticStandardMoveNames(input: {
  availableStandardMoves: SessionInfoStandardMove[]
  selectedStandardMoveIds: string[]
}): string[] {
  const standardMoveById = new Map(
    input.availableStandardMoves.map((standardMove) => [standardMove.id, standardMove]),
  )
  const names = input.selectedStandardMoveIds
    .map((standardMoveId) => standardMoveById.get(standardMoveId)?.name ?? null)
    .filter((standardMoveName): standardMoveName is string => standardMoveName !== null)

  return [...new Set(names)].sort((left, right) => left.localeCompare(right))
}

function buildOptimisticInfoState(input: {
  draft: SessionInfoSaveDraft
  availableStandardMoves: SessionInfoStandardMove[]
}): SessionInfoState {
  return {
    bestOfSession: normalizeInfoText(input.draft.bestOfSession),
    toWork: normalizeInfoText(input.draft.toWork),
    freeNotes: normalizeInfoText(input.draft.freeNotes),
    windPatterns: normalizeInfoText(input.draft.windPatterns),
    standardMoves: buildOptimisticStandardMoveNames({
      availableStandardMoves: input.availableStandardMoves,
      selectedStandardMoveIds: input.draft.standardMoveIds,
    }),
  }
}

function appendSessionInfoFormData(input: {
  formData: FormData
  sessionId: string
  scope: NavigationScope
  draft: SessionInfoSaveDraft
}) {
  input.formData.set("sessionId", input.sessionId)
  input.formData.set("scopeOrgId", input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    input.formData.set("scopeTeamId", input.scope.activeTeamId)
  }

  input.formData.set("scopeTab", "info")
  input.formData.set("bestOfSession", input.draft.bestOfSession)
  input.formData.set("toWork", input.draft.toWork)
  input.formData.set("freeNotes", input.draft.freeNotes)
  input.formData.set("windPatterns", input.draft.windPatterns)

  for (const standardMoveId of input.draft.standardMoveIds) {
    input.formData.append("standardMoveId", standardMoveId)
  }
}

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
  isSaving: boolean
  label: string
}) {
  const { pending } = useFormStatus()
  const isPending = pending || props.isSaving

  return (
    <Button type="submit" disabled={isPending || !props.canSubmit} className={props.className}>
      {isPending ? (
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

function InfoDialogFieldset(props: {
  children: React.ReactNode
  className?: string
  isSaving: boolean
}) {
  const { pending } = useFormStatus()
  const isPending = pending || props.isSaving
  const className = [
    "min-h-0 flex-1 overflow-y-auto px-4 pb-4",
    props.className ?? "space-y-4",
  ].join(" ")

  return (
    <fieldset disabled={isPending} className={className}>
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
  onStandardMoveCreate: (input: {
    standardMove: SessionInfoStandardMove
    availableStandardMoves: SessionInfoStandardMove[]
  }) => void
  onSave: (draft: SessionInfoSaveDraft) => Promise<boolean>
}) {
  const [bestOfSession, setBestOfSession] = React.useState(input.bestOfSession ?? "")
  const [toWork, setToWork] = React.useState(input.toWork ?? "")
  const [standardMoveIds, setStandardMoveIds] = React.useState<string[]>(input.linkedStandardMoveIds)
  const [newStandardMoveName, setNewStandardMoveName] = React.useState("")
  const [newStandardMoveDescription, setNewStandardMoveDescription] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isQuickCreateDialogOpen, setIsQuickCreateDialogOpen] = React.useState(false)
  const [isCreatingStandardMove, setIsCreatingStandardMove] = React.useState(false)
  const [isQuickCreateNameManuallyEdited, setIsQuickCreateNameManuallyEdited] =
    React.useState(false)
  const [windPatterns, setWindPatterns] = React.useState(input.windPatterns ?? "")
  const [freeNotes, setFreeNotes] = React.useState(input.freeNotes ?? "")
  const [standardMoveSearch, setStandardMoveSearch] = React.useState("")
  const isMobile = useIsMobile()
  const hasQuickCreateDescription = newStandardMoveDescription.trim().length > 0
  const standardMoveOptions = input.availableStandardMoves.filter(
    (standardMove) =>
      standardMove.isActive || input.linkedStandardMoveIds.includes(standardMove.id),
  )
  const normalizedStandardMoveSearch = standardMoveSearch.trim().toLowerCase()
  const filteredStandardMoveOptions =
    normalizedStandardMoveSearch.length === 0
      ? standardMoveOptions
      : standardMoveOptions.filter((standardMove) => {
          const searchableText = [
            standardMove.name,
            standardMove.description ?? "",
            standardMove.isActive ? "" : "archived",
          ]
            .join(" ")
            .toLowerCase()

          return searchableText.includes(normalizedStandardMoveSearch)
        })
  const copy = resolveInfoEditCopy(input.section)
  const canCreateStandardMove =
    hasQuickCreateDescription && !isCreatingStandardMove && Boolean(input.scope.activeTeamId)
  const canSubmitInfo = true

  React.useEffect(() => {
    if (isOpen || isSaving) {
      return
    }

    setBestOfSession(input.bestOfSession ?? "")
  }, [input.bestOfSession, isOpen, isSaving])

  React.useEffect(() => {
    if (isOpen || isSaving) {
      return
    }

    setToWork(input.toWork ?? "")
  }, [input.toWork, isOpen, isSaving])

  React.useEffect(() => {
    if (isOpen || isSaving) {
      return
    }

    setFreeNotes(input.freeNotes ?? "")
  }, [input.freeNotes, isOpen, isSaving])

  React.useEffect(() => {
    if (isOpen || isSaving) {
      return
    }

    setWindPatterns(input.windPatterns ?? "")
  }, [input.windPatterns, isOpen, isSaving])

  React.useEffect(() => {
    if (isOpen || isSaving) {
      return
    }

    setStandardMoveIds(input.linkedStandardMoveIds)
  }, [input.linkedStandardMoveIds, isOpen, isSaving])

  function resetQuickCreateState() {
    setNewStandardMoveName("")
    setNewStandardMoveDescription("")
    setIsQuickCreateNameManuallyEdited(false)
  }

  function handleQuickCreateDialogOpenChange(nextOpen: boolean) {
    if (isSaving || isCreatingStandardMove) {
      return
    }

    setIsQuickCreateDialogOpen(nextOpen)

    if (!nextOpen) {
      resetQuickCreateState()
    }
  }

  async function handleQuickCreateSubmit() {
    if (!canCreateStandardMove || !input.scope.activeTeamId) {
      return
    }

    const normalizedDescription = newStandardMoveDescription.trim()
    const resolvedName =
      newStandardMoveName.trim().length > 0
        ? newStandardMoveName.trim()
        : generateStandardMoveNameFromDescription(normalizedDescription)
    const formData = new FormData()

    formData.set("sessionId", input.sessionId)
    formData.set("scopeOrgId", input.scope.activeOrgId)
    formData.set("scopeTeamId", input.scope.activeTeamId)
    formData.set("name", resolvedName)
    formData.set("description", normalizedDescription)

    setIsCreatingStandardMove(true)
    const toastId = toast.loading("Creating standard move...")

    try {
      const result = await createSessionStandardMoveAction(formData)

      if (!result.ok) {
        toast.error(result.message, { id: toastId })
        return
      }

      input.onStandardMoveCreate({
        standardMove: result.standardMove,
        availableStandardMoves: result.availableStandardMoves,
      })
      setStandardMoveIds((currentStandardMoveIds) =>
        currentStandardMoveIds.includes(result.standardMove.id)
          ? currentStandardMoveIds
          : [...currentStandardMoveIds, result.standardMove.id],
      )
      setStandardMoveSearch("")
      resetQuickCreateState()
      setIsQuickCreateDialogOpen(false)
      toast.success("Standard move created and selected.", { id: toastId })
    } catch {
      toast.error("Could not create standard move. Confirm permissions and try again.", {
        id: toastId,
      })
    } finally {
      setIsCreatingStandardMove(false)
    }
  }

  async function handleInfoSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmitInfo || isSaving) {
      return
    }

    const draft: SessionInfoSaveDraft = {
      bestOfSession,
      toWork,
      freeNotes,
      windPatterns,
      standardMoveIds,
    }

    setIsSaving(true)
    setIsQuickCreateDialogOpen(false)
    resetQuickCreateState()
    setIsOpen(false)

    const didSave = await input.onSave(draft)

    if (!didSave) {
      setIsOpen(true)
    }

    setIsSaving(false)
  }

  function handleInfoOpenChange(nextOpen: boolean) {
    if (isSaving || isCreatingStandardMove) {
      return
    }

    setIsOpen(nextOpen)

    if (!nextOpen) {
      setIsQuickCreateDialogOpen(false)
      setStandardMoveSearch("")
      resetQuickCreateState()
    }
  }

  const quickCreatePanel =
    input.section === "standardMoves" ? (
      <div className="shrink-0 border-t bg-popover px-4 py-3">
        <div className="grid gap-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-h-9 items-center">
              <p className="text-sm font-medium">New Standard Move</p>
            </div>
            <Dialog
              open={isQuickCreateDialogOpen}
              onOpenChange={handleQuickCreateDialogOpenChange}
            >
              <DialogTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSaving || isCreatingStandardMove}
                  />
                }
              >
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
                  <fieldset disabled={isCreatingStandardMove} className="space-y-4">
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
                          disabled={
                            isCreatingStandardMove ||
                            newStandardMoveDescription.trim().length === 0
                          }
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
                  </fieldset>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isCreatingStandardMove}
                      onClick={() => handleQuickCreateDialogOpenChange(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={!canCreateStandardMove}
                      onClick={handleQuickCreateSubmit}
                    >
                      {isCreatingStandardMove ? (
                        <>
                          <Loader2Icon className="size-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create"
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    ) : null

  const infoForm = (
    <form
      action={updateSessionInfoAction}
      onSubmit={handleInfoSubmit}
      className="flex min-h-0 flex-1 flex-col"
    >
      <input type="hidden" name="sessionId" value={input.sessionId} />
      <input type="hidden" name="scopeOrgId" value={input.scope.activeOrgId} />
      {input.scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={input.scope.activeTeamId} />
      ) : null}
      <input type="hidden" name="scopeTab" value="info" />
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

      <InfoDialogFieldset
        className={input.section === "standardMoves" ? "flex flex-col gap-4" : undefined}
        isSaving={isSaving}
      >
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
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="relative shrink-0">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={standardMoveSearch}
                  onChange={(event) => setStandardMoveSearch(event.target.value)}
                  placeholder="Search Standard Moves"
                  className="pl-9"
                  aria-label="Search Standard Moves"
                />
              </div>
              <div
                className="min-h-0 flex-1 overflow-y-auto p-1"
                role="group"
                aria-label="Std. Moves"
              >
                {standardMoveOptions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No standard moves available yet.
                  </p>
                ) : filteredStandardMoveOptions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No standard moves match this search.
                  </p>
                ) : (
                  <Accordion className="gap-1">
                    {filteredStandardMoveOptions.map((standardMove) => {
                      const isSelected = standardMoveIds.includes(standardMove.id)
                      const hasDescription =
                        standardMove.description !== null &&
                        standardMove.description.trim().length > 0

                      return (
                        <AccordionItem
                          key={standardMove.id}
                          value={standardMove.id}
                          className="rounded-md border-0"
                        >
                          <div className="flex min-h-12 items-center gap-3 rounded-md px-2 py-2 text-xs transition-colors hover:bg-muted/60">
                            <Checkbox
                              name="standardMoveId"
                              value={standardMove.id}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                setStandardMoveIds((currentStandardMoveIds) => {
                                  if (checked) {
                                    return currentStandardMoveIds.includes(standardMove.id)
                                      ? currentStandardMoveIds
                                      : [...currentStandardMoveIds, standardMove.id]
                                  }

                                  return currentStandardMoveIds.filter(
                                    (standardMoveId) => standardMoveId !== standardMove.id,
                                  )
                                })
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <AccordionTrigger
                                className="w-full py-0 text-sm hover:no-underline [&_[data-slot=accordion-trigger-icon]]:size-4"
                                disabled={!hasDescription && standardMove.isActive}
                              >
                                <span className="truncate">{standardMove.name}</span>
                              </AccordionTrigger>
                            </div>
                          </div>
                          <AccordionContent className="pl-11 pr-2 pb-3 text-sm text-muted-foreground">
                            {hasDescription ? (
                              <p className="whitespace-pre-wrap">{standardMove.description}</p>
                            ) : null}
                            {!standardMove.isActive ? (
                              <p className={hasDescription ? "mt-2" : undefined}>Archived</p>
                            ) : null}
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                )}
              </div>
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

      {quickCreatePanel}

      {isMobile ? (
        <DrawerFooter className="shrink-0">
          <InfoDialogSubmitButton
            canSubmit={canSubmitInfo}
            className="w-full"
            isSaving={isSaving}
            label={copy.submitLabel}
          />
        </DrawerFooter>
      ) : (
        <SheetFooter className="shrink-0">
          <InfoDialogSubmitButton
            canSubmit={canSubmitInfo}
            className="w-full"
            isSaving={isSaving}
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
      <Drawer open={isOpen} onOpenChange={handleInfoOpenChange}>
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
    <Sheet open={isOpen} onOpenChange={handleInfoOpenChange}>
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

const MOBILE_SESSION_DETAIL_TAB_LIST_X_PADDING = 6

const MOBILE_SESSION_DETAIL_TAB_MEASURE_TRIGGER_CLASS =
  "relative inline-flex h-[calc(100%-1px)] flex-none items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap"

type MobileSessionDetailTabWidthMap = Record<SessionDetailTab, number>

type MobileSessionDetailTabMetrics = {
  containerWidth: number
  moreWidth: number
  tabWidths: MobileSessionDetailTabWidthMap
}

function formatSessionDetailTabLabel(tab: SessionDetailTab): string {
  return tab.charAt(0).toUpperCase() + tab.slice(1)
}

function getMobileSessionDetailTabsWidth(
  tabs: readonly SessionDetailTab[],
  tabWidths: MobileSessionDetailTabWidthMap,
): number {
  return tabs.reduce(
    (totalWidth, tab) => totalWidth + tabWidths[tab],
    MOBILE_SESSION_DETAIL_TAB_LIST_X_PADDING,
  )
}

function getVisibleMobileSessionDetailTabs(input: {
  metrics: MobileSessionDetailTabMetrics
  orderedTabs: readonly SessionDetailTab[]
  requiredTab?: SessionDetailTab
}): SessionDetailTab[] {
  const allTabsWidth = getMobileSessionDetailTabsWidth(
    SESSION_DETAIL_TABS,
    input.metrics.tabWidths,
  )

  if (allTabsWidth <= input.metrics.containerWidth) {
    return [...SESSION_DETAIL_TABS]
  }

  const availableTabsWidth = Math.max(
    0,
    input.metrics.containerWidth -
      input.metrics.moreWidth -
      MOBILE_SESSION_DETAIL_TAB_LIST_X_PADDING,
  )
  const visibleTabs: SessionDetailTab[] = []
  let usedTabsWidth = 0

  for (const tab of input.orderedTabs) {
    const tabWidth = input.metrics.tabWidths[tab]

    if (tab === input.requiredTab) {
      while (visibleTabs.length > 0 && usedTabsWidth + tabWidth > availableTabsWidth) {
        const removedTab = visibleTabs.pop()

        if (!removedTab) {
          break
        }

        usedTabsWidth -= input.metrics.tabWidths[removedTab]
      }

      if (visibleTabs.length === 0 || usedTabsWidth + tabWidth <= availableTabsWidth) {
        visibleTabs.push(tab)
        usedTabsWidth += tabWidth
      }

      continue
    }

    if (visibleTabs.length === 0 || usedTabsWidth + tabWidth <= availableTabsWidth) {
      visibleTabs.push(tab)
      usedTabsWidth += tabWidth
    }
  }

  return visibleTabs.length > 0 ? visibleTabs : [input.orderedTabs[0] ?? "info"]
}

function moveMobileSessionDetailTabIntoView(input: {
  orderedTabs: readonly SessionDetailTab[]
  tab: SessionDetailTab
  visibleTabs: readonly SessionDetailTab[]
}): SessionDetailTab[] {
  if (input.visibleTabs.includes(input.tab)) {
    return [...input.orderedTabs]
  }

  const tabIndex = input.orderedTabs.indexOf(input.tab)
  const replacementTab = input.visibleTabs.at(-1)

  if (tabIndex === -1 || !replacementTab) {
    return [...input.orderedTabs]
  }

  const replacementIndex = input.orderedTabs.indexOf(replacementTab)

  if (replacementIndex === -1) {
    return [...input.orderedTabs]
  }

  const nextOrderedTabs = [...input.orderedTabs]
  nextOrderedTabs[replacementIndex] = input.tab
  nextOrderedTabs[tabIndex] = replacementTab
  return nextOrderedTabs
}

function areMobileSessionDetailTabMetricsEqual(
  left: MobileSessionDetailTabMetrics,
  right: MobileSessionDetailTabMetrics,
): boolean {
  if (left.containerWidth !== right.containerWidth || left.moreWidth !== right.moreWidth) {
    return false
  }

  return SESSION_DETAIL_TABS.every((tab) => left.tabWidths[tab] === right.tabWidths[tab])
}

function MobileSessionDetailTabsList(input: {
  selectedTab: SessionDetailTab
  onTabChange: (tab: SessionDetailTab) => void
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const moreMeasureRef = React.useRef<HTMLButtonElement | null>(null)
  const tabMeasureRefs = React.useRef<
    Partial<Record<SessionDetailTab, HTMLButtonElement | null>>
  >({})
  const [metrics, setMetrics] = React.useState<MobileSessionDetailTabMetrics | null>(null)
  const [tabOrder, setTabOrder] = React.useState<SessionDetailTab[]>(() => [
    ...SESSION_DETAIL_TABS,
  ])

  const measureTabs = React.useCallback(() => {
    const container = containerRef.current
    const moreMeasure = moreMeasureRef.current

    if (!container || !moreMeasure) {
      return
    }

    const nextTabWidths = {} as MobileSessionDetailTabWidthMap

    for (const tab of SESSION_DETAIL_TABS) {
      const tabMeasure = tabMeasureRefs.current[tab]

      if (!tabMeasure) {
        return
      }

      nextTabWidths[tab] = Math.ceil(tabMeasure.getBoundingClientRect().width)
    }

    const nextMetrics: MobileSessionDetailTabMetrics = {
      containerWidth: Math.floor(container.getBoundingClientRect().width),
      moreWidth: Math.ceil(moreMeasure.getBoundingClientRect().width),
      tabWidths: nextTabWidths,
    }

    if (nextMetrics.containerWidth <= 0 || nextMetrics.moreWidth <= 0) {
      return
    }

    setMetrics((currentMetrics) =>
      currentMetrics && areMobileSessionDetailTabMetricsEqual(currentMetrics, nextMetrics)
        ? currentMetrics
        : nextMetrics,
    )
  }, [])

  React.useEffect(() => {
    measureTabs()

    const animationFrame = window.requestAnimationFrame(measureTabs)
    const container = containerRef.current
    const resizeObserver =
      typeof ResizeObserver === "undefined" || !container
        ? null
        : new ResizeObserver(() => {
            measureTabs()
          })

    if (resizeObserver && container) {
      resizeObserver.observe(container)
    }

    window.addEventListener("resize", measureTabs)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", measureTabs)
    }
  }, [measureTabs])

  const visibleTabs = React.useMemo(
    () =>
      metrics
        ? getVisibleMobileSessionDetailTabs({
            metrics,
            orderedTabs: tabOrder,
            requiredTab: input.selectedTab,
          })
        : [...SESSION_DETAIL_TABS],
    [input.selectedTab, metrics, tabOrder],
  )
  const allTabsVisible = visibleTabs.length === SESSION_DETAIL_TABS.length
  const overflowTabs = allTabsVisible
    ? []
    : tabOrder.filter((tab) => !visibleTabs.includes(tab))

  function setTabMeasureRef(tab: SessionDetailTab) {
    return (node: HTMLButtonElement | null) => {
      tabMeasureRefs.current[tab] = node
    }
  }

  function handleOverflowTabSelect(tab: SessionDetailTab): void {
    setTabOrder((currentTabOrder) => {
      if (!metrics) {
        return currentTabOrder
      }

      const currentVisibleTabs = getVisibleMobileSessionDetailTabs({
        metrics,
        orderedTabs: currentTabOrder,
      })

      return moveMobileSessionDetailTabIntoView({
        orderedTabs: currentTabOrder,
        tab,
        visibleTabs: currentVisibleTabs,
      })
    })
    input.onTabChange(tab)
  }

  return (
    <div ref={containerRef} className="w-full">
      <div
        className={cn(
          "inline-flex h-10 max-w-full items-center rounded-lg bg-muted p-[3px] text-muted-foreground",
          allTabsVisible ? "w-full" : "w-fit",
        )}
      >
        <TabsList
          className={cn(
            "h-full min-w-0 rounded-md bg-transparent p-0",
            allTabsVisible ? "w-full flex-1" : "w-fit shrink-0",
          )}
        >
          {visibleTabs.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className={cn(
                "capitalize",
                allTabsVisible ? "min-w-0 flex-1 px-2" : "min-w-fit shrink-0",
              )}
            >
              {formatSessionDetailTabLabel(tab)}
            </TabsTrigger>
          ))}
        </TabsList>

        {!allTabsVisible ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-[calc(100%-1px)] shrink-0 rounded-md px-2 text-foreground/60 hover:text-foreground"
                />
              }
            >
              <span>More</span>
              <ChevronDownIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {overflowTabs.map((tab) => (
                <DropdownMenuItem
                  key={tab}
                  onClick={() => handleOverflowTabSelect(tab)}
                  className="gap-2"
                >
                  <span className="flex size-4 items-center justify-center">
                    {input.selectedTab === tab ? <CheckIcon className="size-4" /> : null}
                  </span>
                  <span className="flex-1">{formatSessionDetailTabLabel(tab)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 -z-10 opacity-0"
      >
        <div className="inline-flex h-10 items-center rounded-lg bg-muted p-[3px] text-muted-foreground">
          {SESSION_DETAIL_TABS.map((tab) => (
            <button
              key={tab}
              ref={setTabMeasureRef(tab)}
              type="button"
              tabIndex={-1}
              className={MOBILE_SESSION_DETAIL_TAB_MEASURE_TRIGGER_CLASS}
            >
              {formatSessionDetailTabLabel(tab)}
            </button>
          ))}
          <button
            ref={moreMeasureRef}
            type="button"
            tabIndex={-1}
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "h-[calc(100%-1px)] rounded-md px-2",
            })}
          >
            <span>More</span>
            <ChevronDownIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function SessionHeaderActions(input: {
  sessionId: string
  scope: NavigationScope
  setupDialogItems: SessionSetupDialogItem[]
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
  const router = useRouter()
  const [info, setInfo] = React.useState<SessionInfoState>(input.info)
  const [availableStandardMoves, setAvailableStandardMoves] = React.useState<
    SessionInfoStandardMove[]
  >(input.availableStandardMoves)
  const [linkedStandardMoveIds, setLinkedStandardMoveIds] = React.useState<string[]>(
    input.linkedStandardMoveIds,
  )

  React.useEffect(() => {
    setInfo(input.info)
  }, [input.info])

  React.useEffect(() => {
    setAvailableStandardMoves(input.availableStandardMoves)
  }, [input.availableStandardMoves])

  React.useEffect(() => {
    setLinkedStandardMoveIds(input.linkedStandardMoveIds)
  }, [input.linkedStandardMoveIds])

  const handleInfoSave = React.useCallback(
    async (draft: SessionInfoSaveDraft): Promise<boolean> => {
      const previousInfo = info
      const optimisticInfo = buildOptimisticInfoState({
        draft,
        availableStandardMoves,
      })
      const toastId = `session-info-save:${input.sessionId}`
      const formData = new FormData()

      appendSessionInfoFormData({
        formData,
        sessionId: input.sessionId,
        scope: input.scope,
        draft,
      })
      setInfo(optimisticInfo)

      try {
        const result = await saveSessionInfoAction(formData)

        if (!result.ok) {
          setInfo(previousInfo)
          toast.error(result.message, { id: toastId })
          return false
        }

        setInfo(result.info)
        setAvailableStandardMoves(result.availableStandardMoves)
        setLinkedStandardMoveIds(result.linkedStandardMoveIds)
        toast.success("Session info saved.", { id: toastId })
        router.refresh()
        return true
      } catch {
        setInfo(previousInfo)
        toast.error("Could not update this session. Confirm your permissions and try again.", {
          id: toastId,
        })
        return false
      }
    },
    [availableStandardMoves, info, input.scope, input.sessionId, router],
  )

  const handleStandardMoveCreate = React.useCallback(
    (result: {
      standardMove: SessionInfoStandardMove
      availableStandardMoves: SessionInfoStandardMove[]
    }) => {
      const hasCreatedMove = result.availableStandardMoves.some(
        (standardMove) => standardMove.id === result.standardMove.id,
      )
      const nextAvailableStandardMoves = hasCreatedMove
        ? result.availableStandardMoves
        : [...result.availableStandardMoves, result.standardMove].sort((left, right) =>
            left.name.localeCompare(right.name),
          )

      setAvailableStandardMoves(nextAvailableStandardMoves)
    },
    [],
  )

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => setSelectedTab(resolveTab(value))}
      className="space-y-4"
    >
      <div className="md:hidden">
        <MobileSessionDetailTabsList selectedTab={selectedTab} onTabChange={setSelectedTab} />
      </div>

      <TabsList className="hidden h-10 md:inline-flex">
        {SESSION_DETAIL_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="min-w-fit capitalize">
            {formatSessionDetailTabLabel(tab)}
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
                      bestOfSession={info.bestOfSession}
                      toWork={info.toWork}
                      availableStandardMoves={availableStandardMoves}
                      linkedStandardMoveIds={linkedStandardMoveIds}
                      windPatterns={info.windPatterns}
                      freeNotes={info.freeNotes}
                      onStandardMoveCreate={handleStandardMoveCreate}
                      onSave={handleInfoSave}
                    />
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Best
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {renderTextValue(info.bestOfSession)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      To Work
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {renderTextValue(info.toWork)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-4 sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Free Notes
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {renderTextValue(info.freeNotes)}
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
                      bestOfSession={info.bestOfSession}
                      toWork={info.toWork}
                      availableStandardMoves={availableStandardMoves}
                      linkedStandardMoveIds={linkedStandardMoveIds}
                      windPatterns={info.windPatterns}
                      freeNotes={info.freeNotes}
                      onStandardMoveCreate={handleStandardMoveCreate}
                      onSave={handleInfoSave}
                    />
                  ) : null}
                </div>

                <div className="rounded-lg bg-muted p-4">
                  <SessionInfoStandardMovesBadges
                    availableStandardMoves={availableStandardMoves}
                    linkedStandardMoveIds={linkedStandardMoveIds}
                    fallbackStandardMoveNames={info.standardMoves}
                  />
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
                      bestOfSession={info.bestOfSession}
                      toWork={info.toWork}
                      availableStandardMoves={availableStandardMoves}
                      linkedStandardMoveIds={linkedStandardMoveIds}
                      windPatterns={info.windPatterns}
                      freeNotes={info.freeNotes}
                      onStandardMoveCreate={handleStandardMoveCreate}
                      onSave={handleInfoSave}
                    />
                  ) : null}
                </div>

                <div className="rounded-lg bg-muted p-4">
                  <p className="whitespace-pre-wrap text-sm">
                    {renderTextValue(info.windPatterns)}
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
