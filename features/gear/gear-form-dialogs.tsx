"use client"

import * as React from "react"
import {
  CameraIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react"
import { useFormStatus } from "react-dom"

import {
  createGearItemAction,
  retireGearItemAction,
  updateGearItemAction,
  updateGearTwsMultipliersAction,
} from "@/features/gear/actions"
import { getDefaultTwsMultiplier } from "@/features/gear/tws-multiplier-defaults.mjs"
import type {
  TeamGearAlertRuleItem,
  TeamGearListItem,
  TeamGearTwsOption,
} from "@/features/gear/shared"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
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
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type GearTypeOption = { value: string; label: string }
type GearStatusOption = { value: string; label: string }
type GearConditionOption = { value: string; label: string }
type GearFormSurface = "drawer" | "sheet"
type GearRuleMetric = TeamGearListItem["alertRules"][number]["metric"]

type GearRuleDraft = {
  draftKey: string
  metric: GearRuleMetric
  pastDueThresholdValue: number
  nearLimitThresholdValue: number | null
}

type GearFormInitialValues = {
  id?: string
  name: string
  gearType: TeamGearListItem["gearType"]
  serialNumber: string
  barcode: string
  status: TeamGearListItem["status"]
  condition: TeamGearListItem["condition"]
  alertRules: GearRuleDraft[]
}

type EditableGearItem = Pick<
  TeamGearListItem,
  | "id"
  | "name"
  | "gearType"
  | "serialNumber"
  | "barcode"
  | "status"
  | "condition"
  | "alertRules"
  | "twsMultipliers"
>

type GearTwsMultiplierDraft = {
  optionId: string
  usageMinutesMultiplier: number
  usageCountMultiplier: number
}

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

const GEAR_RULE_METRIC_OPTIONS: Array<{
  value: GearRuleMetric
  label: string
  defaultPastDueThresholdValue: number
}> = [
  {
    value: "usage_minutes",
    label: "Minutes",
    defaultPastDueThresholdValue: 60,
  },
  {
    value: "usage_count",
    label: "Times Used",
    defaultPastDueThresholdValue: 10,
  },
]

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

function normalizeBarcodeValue(value: string): string {
  return value.trim()
}

function BarcodeScannerDialog({
  onDetected,
  buttonClassName,
  disabled = false,
}: {
  onDetected: (value: string) => void
  buttonClassName?: string
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
        "Barcode scanning is not supported in this browser. Enter the barcode manually.",
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
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={buttonClassName}
          />
        }
      >
        <CameraIcon className="size-4" />
        Scan
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan barcode</DialogTitle>
          <DialogDescription>
            Point your camera at the barcode. The code will be filled automatically.
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
              Tip: move closer or improve lighting if it does not detect quickly.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

let nextRuleDraftId = 0

function createRuleDraftKey(): string {
  nextRuleDraftId += 1

  return `new-rule-${nextRuleDraftId}`
}

function getMetricLabel(metric: GearRuleMetric): string {
  return (
    GEAR_RULE_METRIC_OPTIONS.find((option) => option.value === metric)?.label ??
    "Usage"
  )
}

function getDefaultPastDueThresholdValue(metric: GearRuleMetric): number {
  return (
    GEAR_RULE_METRIC_OPTIONS.find((option) => option.value === metric)
      ?.defaultPastDueThresholdValue ?? 10
  )
}

function mapRulesForDraft(rules: TeamGearAlertRuleItem[]): GearRuleDraft[] {
  const draftsByMetric = new Map<
    GearRuleMetric,
    {
      draftKey: string
      metric: GearRuleMetric
      pastDueThresholdValue: number | null
      nearLimitThresholdValue: number | null
    }
  >()

  for (const rule of rules) {
    const existingDraft = draftsByMetric.get(rule.metric) ?? {
      draftKey: rule.id,
      metric: rule.metric,
      pastDueThresholdValue: null,
      nearLimitThresholdValue: null,
    }

    if (rule.severity === "warning") {
      existingDraft.pastDueThresholdValue =
        existingDraft.pastDueThresholdValue === null
          ? rule.thresholdValue
          : Math.min(existingDraft.pastDueThresholdValue, rule.thresholdValue)
    } else {
      existingDraft.nearLimitThresholdValue =
        existingDraft.nearLimitThresholdValue === null
          ? rule.thresholdValue
          : Math.max(existingDraft.nearLimitThresholdValue, rule.thresholdValue)
    }

    draftsByMetric.set(rule.metric, existingDraft)
  }

  return GEAR_RULE_METRIC_OPTIONS.flatMap((option) => {
    const draft = draftsByMetric.get(option.value)

    if (!draft) {
      return []
    }

    const pastDueThresholdValue =
      draft.pastDueThresholdValue ??
      draft.nearLimitThresholdValue ??
      getDefaultPastDueThresholdValue(draft.metric)
    const nearLimitThresholdValue =
      draft.pastDueThresholdValue !== null &&
      draft.nearLimitThresholdValue !== null &&
      draft.nearLimitThresholdValue < pastDueThresholdValue
        ? draft.nearLimitThresholdValue
        : null

    return [
      {
        draftKey: draft.draftKey,
        metric: draft.metric,
        pastDueThresholdValue,
        nearLimitThresholdValue,
      },
    ]
  })
}

function createDefaultRule(existingRules: GearRuleDraft[]): GearRuleDraft | null {
  const usedMetrics = new Set(existingRules.map((rule) => rule.metric))
  const nextMetric = GEAR_RULE_METRIC_OPTIONS.find(
    (option) => !usedMetrics.has(option.value),
  )?.value

  if (!nextMetric) {
    return null
  }

  return {
    draftKey: createRuleDraftKey(),
    metric: nextMetric,
    pastDueThresholdValue: getDefaultPastDueThresholdValue(nextMetric),
    nearLimitThresholdValue: null,
  }
}

function hasInvalidRule(rule: GearRuleDraft): boolean {
  return (
    !Number.isInteger(rule.pastDueThresholdValue) ||
    rule.pastDueThresholdValue <= 0 ||
    (rule.nearLimitThresholdValue !== null &&
      (!Number.isInteger(rule.nearLimitThresholdValue) ||
        rule.nearLimitThresholdValue <= 0 ||
        rule.nearLimitThresholdValue >= rule.pastDueThresholdValue))
  )
}

function hasDuplicateRuleMetrics(rules: GearRuleDraft[]): boolean {
  return new Set(rules.map((rule) => rule.metric)).size !== rules.length
}

function GearDialogFields({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <fieldset
      disabled={pending}
      className={cn(
        "space-y-5 disabled:pointer-events-none disabled:opacity-70",
        className,
      )}
    >
      {children}
    </fieldset>
  )
}

function GearDialogSubmitButton({
  submitLabel,
  pendingLabel,
  canSubmit,
  className,
}: {
  submitLabel: string
  pendingLabel: string
  canSubmit: boolean
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={!canSubmit || pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        submitLabel
      )}
    </Button>
  )
}

function GearDialogFooter({
  submitLabel,
  pendingLabel,
  canSubmit,
  surface,
}: {
  submitLabel: string
  pendingLabel: string
  canSubmit: boolean
  surface: GearFormSurface
}) {
  const button = (
    <GearDialogSubmitButton
      submitLabel={submitLabel}
      pendingLabel={pendingLabel}
      canSubmit={canSubmit}
      className={surface === "drawer" ? "h-11 w-full" : undefined}
    />
  )

  if (surface === "drawer") {
    return <DrawerFooter className="shrink-0 border-t">{button}</DrawerFooter>
  }

  return (
    <SheetFooter className="shrink-0 border-t sm:justify-end">
      {button}
    </SheetFooter>
  )
}

function GearRouteScopeHiddenFields({
  scope,
  selectedType,
  selectedStatusFilter,
  selectedCondition,
  selectedAlert,
  currentPage,
  loadMoreMode,
}: {
  scope: NavigationScope
  selectedType?: string
  selectedStatusFilter?: string
  selectedCondition?: string
  selectedAlert?: string
  currentPage: number
  loadMoreMode: boolean
}) {
  return (
    <>
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {selectedType ? <input type="hidden" name="scopeType" value={selectedType} /> : null}
      {selectedStatusFilter ? (
        <input type="hidden" name="scopeStatus" value={selectedStatusFilter} />
      ) : null}
      {selectedCondition ? (
        <input type="hidden" name="scopeCondition" value={selectedCondition} />
      ) : null}
      {selectedAlert ? <input type="hidden" name="scopeAlert" value={selectedAlert} /> : null}
      {currentPage > 1 ? (
        <input type="hidden" name="scopePage" value={String(currentPage)} />
      ) : null}
      {loadMoreMode && currentPage > 1 ? (
        <input type="hidden" name="scopeLoadMore" value="1" />
      ) : null}
    </>
  )
}

function GearDialogForm({
  initialValues,
  idPrefix,
  submitLabel,
  pendingLabel,
  scope,
  selectedType,
  selectedStatusFilter,
  selectedCondition,
  selectedAlert,
  currentPage,
  loadMoreMode,
  gearTypeOptions,
  gearStatusOptions,
  gearConditionOptions,
  action,
  surface,
}: {
  initialValues: GearFormInitialValues
  idPrefix: string
  submitLabel: string
  pendingLabel: string
  scope: NavigationScope
  selectedType?: string
  selectedStatusFilter?: string
  selectedCondition?: string
  selectedAlert?: string
  currentPage: number
  loadMoreMode: boolean
  gearTypeOptions: GearTypeOption[]
  gearStatusOptions: GearStatusOption[]
  gearConditionOptions: GearConditionOption[]
  action: (formData: FormData) => void | Promise<void>
  surface: GearFormSurface
}) {
  const [name, setName] = React.useState(initialValues.name)
  const [gearType, setGearType] = React.useState(initialValues.gearType)
  const [serialNumber, setSerialNumber] = React.useState(initialValues.serialNumber)
  const [barcode, setBarcode] = React.useState(initialValues.barcode)
  const [status, setStatus] = React.useState(initialValues.status)
  const [condition, setCondition] = React.useState(initialValues.condition)
  const [alertRules, setAlertRules] = React.useState<GearRuleDraft[]>(initialValues.alertRules)

  const canSubmit =
    name.trim().length > 0 &&
    gearType.length > 0 &&
    status.length > 0 &&
    condition.length > 0 &&
    !hasDuplicateRuleMetrics(alertRules) &&
    alertRules.every((rule) => !hasInvalidRule(rule))
  const isDrawerSurface = surface === "drawer"
  const inputClassName = isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined
  const selectClassName = cn(
    "w-full rounded-lg border border-input bg-background px-3 outline-none ring-ring/50 focus-visible:ring-[3px]",
    isDrawerSurface ? "h-11 text-base md:text-sm" : "h-9 text-sm",
  )
  const compactButtonClassName = isDrawerSurface ? "h-11 px-3" : undefined
  const ruleInputClassName = "h-11 px-3 text-base md:text-sm"
  const ruleSelectClassName =
    "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none ring-ring/50 focus-visible:ring-[3px] md:text-sm"
  const ruleDeleteButtonClassName =
    "h-11 w-11 shrink-0 border border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/15 hover:text-red-700 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
  const canAddRule = alertRules.length < GEAR_RULE_METRIC_OPTIONS.length

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {initialValues.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
      {selectedType ? <input type="hidden" name="scopeType" value={selectedType} /> : null}
      {selectedStatusFilter ? (
        <input type="hidden" name="scopeStatus" value={selectedStatusFilter} />
      ) : null}
      {selectedCondition ? (
        <input type="hidden" name="scopeCondition" value={selectedCondition} />
      ) : null}
      {selectedAlert ? <input type="hidden" name="scopeAlert" value={selectedAlert} /> : null}
      {currentPage > 1 ? (
        <input type="hidden" name="scopePage" value={String(currentPage)} />
      ) : null}
      {loadMoreMode && currentPage > 1 ? (
        <input type="hidden" name="scopeLoadMore" value="1" />
      ) : null}
      <input
        type="hidden"
        name="alertRulesPayload"
        value={JSON.stringify(
          alertRules.map((rule) => ({
            metric: rule.metric,
            pastDueThresholdValue: rule.pastDueThresholdValue,
            nearLimitThresholdValue: rule.nearLimitThresholdValue,
          })),
        )}
      />

      <GearDialogFields className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-name`}>Name</Label>
            <Input
              id={`${idPrefix}-name`}
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={120}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-gearType`}>Type</Label>
            <select
              id={`${idPrefix}-gearType`}
              name="gearType"
              value={gearType}
              onChange={(event) =>
                setGearType(event.target.value as TeamGearListItem["gearType"])
              }
              required
              className={selectClassName}
            >
              {gearTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-status`}>Status</Label>
            <select
              id={`${idPrefix}-status`}
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as TeamGearListItem["status"])}
              required
              className={selectClassName}
            >
              {gearStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-condition`}>Condition</Label>
            <select
              id={`${idPrefix}-condition`}
              name="condition"
              value={condition}
              onChange={(event) =>
                setCondition(event.target.value as TeamGearListItem["condition"])
              }
              required
              className={selectClassName}
            >
              {gearConditionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-serialNumber`}>Serial Number</Label>
            <Input
              id={`${idPrefix}-serialNumber`}
              name="serialNumber"
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              maxLength={120}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-barcode`}>Barcode</Label>
            <div className="flex items-center gap-2">
              <Input
                id={`${idPrefix}-barcode`}
                name="barcode"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                maxLength={120}
                className={inputClassName}
              />
              <BarcodeScannerDialog
                onDetected={(value) => {
                  setBarcode(value)
                }}
                buttonClassName={compactButtonClassName}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold">Usage Thresholds</h4>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={compactButtonClassName}
              disabled={!canAddRule}
              onClick={() => {
                setAlertRules((existingRules) => {
                  const nextRule = createDefaultRule(existingRules)

                  return nextRule ? [...existingRules, nextRule] : existingRules
                })
              }}
            >
              <PlusIcon className="size-4" />
              Threshold
            </Button>
          </div>

          {alertRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No thresholds configured. This item will stay OK.
            </p>
          ) : (
            <div className="space-y-3">
              {alertRules.map((rule, index) => {
                const usedMetrics = new Set(
                  alertRules
                    .filter((_, ruleIndex) => ruleIndex !== index)
                    .map((existingRule) => existingRule.metric),
                )
                const nearLimitInputId = `${idPrefix}-threshold-${rule.draftKey}-near-limit`
                const pastDueInputId = `${idPrefix}-threshold-${rule.draftKey}-past-due`
                const metricInputId = `${idPrefix}-threshold-${rule.draftKey}-metric`

                return (
                  <div key={rule.draftKey} className="space-y-3 rounded-md border p-3">
                    <div className="space-y-1">
                      <Label htmlFor={metricInputId} className="text-xs">
                        Metric
                      </Label>
                      <select
                        id={metricInputId}
                        value={rule.metric}
                        onChange={(event) => {
                          const nextMetric = event.target.value as GearRuleMetric

                          setAlertRules((existingRules) => {
                            const nextRules = [...existingRules]
                            nextRules[index] = {
                              ...nextRules[index],
                              metric: nextMetric,
                              pastDueThresholdValue:
                                nextRules[index]?.pastDueThresholdValue ??
                                getDefaultPastDueThresholdValue(nextMetric),
                            }
                            return nextRules
                          })
                        }}
                        className={ruleSelectClassName}
                      >
                        {GEAR_RULE_METRIC_OPTIONS.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            disabled={usedMetrics.has(option.value)}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor={pastDueInputId} className="text-xs">
                          Past Due at
                        </Label>
                        <Input
                          id={pastDueInputId}
                          type="number"
                          min={1}
                          value={String(rule.pastDueThresholdValue)}
                          onChange={(event) => {
                            const nextValue = Number.parseInt(event.target.value, 10)

                            setAlertRules((existingRules) => {
                              const nextRules = [...existingRules]
                              nextRules[index] = {
                                ...nextRules[index],
                                pastDueThresholdValue: Number.isFinite(nextValue)
                                  ? nextValue
                                  : 0,
                              }
                              return nextRules
                            })
                          }}
                          className={ruleInputClassName}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={nearLimitInputId} className="text-xs">
                          Near Limit starts at
                        </Label>
                        <Input
                          id={nearLimitInputId}
                          type="number"
                          min={1}
                          value={
                            rule.nearLimitThresholdValue === null
                              ? ""
                              : String(rule.nearLimitThresholdValue)
                          }
                          onChange={(event) => {
                            const rawValue = event.target.value
                            const nextValue =
                              rawValue.length > 0 ? Number.parseInt(rawValue, 10) : null

                            setAlertRules((existingRules) => {
                              const nextRules = [...existingRules]
                              nextRules[index] = {
                                ...nextRules[index],
                                nearLimitThresholdValue:
                                  nextValue !== null && Number.isFinite(nextValue)
                                    ? nextValue
                                    : null,
                              }
                              return nextRules
                            })
                          }}
                          placeholder="Optional"
                          className={ruleInputClassName}
                        />
                      </div>
                    </div>

                    <div className="flex min-h-11 items-center justify-between gap-3">
                      <p className="truncate text-xs text-muted-foreground">
                        {getMetricLabel(rule.metric)}
                      </p>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={ruleDeleteButtonClassName}
                        aria-label={`Remove rule ${index + 1}`}
                        onClick={() => {
                          setAlertRules((existingRules) =>
                            existingRules.filter((_, ruleIndex) => ruleIndex !== index),
                          )
                        }}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </GearDialogFields>

      <GearDialogFooter
        submitLabel={submitLabel}
        pendingLabel={pendingLabel}
        canSubmit={canSubmit}
        surface={surface}
      />
    </form>
  )
}

export function CreateGearDialog({
  scope,
  selectedType,
  selectedStatusFilter,
  selectedCondition,
  selectedAlert,
  currentPage,
  loadMoreMode = false,
  gearTypeOptions,
  gearStatusOptions,
  gearConditionOptions,
  disabled,
  surface = "sheet",
  triggerVariant = "default",
}: {
  scope: NavigationScope
  selectedType?: string
  selectedStatusFilter?: string
  selectedCondition?: string
  selectedAlert?: string
  currentPage: number
  loadMoreMode?: boolean
  gearTypeOptions: GearTypeOption[]
  gearStatusOptions: GearStatusOption[]
  gearConditionOptions: GearConditionOption[]
  disabled: boolean
  surface?: GearFormSurface
  triggerVariant?: "default" | "fab"
}) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const defaultGearType = (gearTypeOptions[0]?.value ?? "sails") as TeamGearListItem["gearType"]
  const defaultStatus = (gearStatusOptions[0]?.value ??
    "active_regatta") as TeamGearListItem["status"]
  const defaultCondition = (gearConditionOptions[0]?.value ??
    "used") as TeamGearListItem["condition"]
  const isFabTrigger = triggerVariant === "fab"
  const createForm = (
    <GearDialogForm
      initialValues={{
        name: "",
        gearType: defaultGearType,
        serialNumber: "",
        barcode: "",
        status: defaultStatus,
        condition: defaultCondition,
        alertRules: [],
      }}
      idPrefix={`create-gear-${surface}-${triggerVariant}`}
      submitLabel="Create item"
      pendingLabel="Creating item..."
      scope={scope}
      selectedType={selectedType}
      selectedStatusFilter={selectedStatusFilter}
      selectedCondition={selectedCondition}
      selectedAlert={selectedAlert}
      currentPage={currentPage}
      loadMoreMode={loadMoreMode}
      gearTypeOptions={gearTypeOptions}
      gearStatusOptions={gearStatusOptions}
      gearConditionOptions={gearConditionOptions}
      action={createGearItemAction}
      surface={surface}
    />
  )

  if (surface === "drawer") {
    return (
      <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <button
          type="button"
          disabled={disabled}
          aria-label={isFabTrigger ? "New gear item" : undefined}
          aria-haspopup="dialog"
          aria-expanded={isCreateOpen}
          className={cn(
            buttonVariants({
              variant: isFabTrigger ? "default" : "outline",
              size: isFabTrigger ? "icon" : "default",
            }),
            isFabTrigger
              ? "mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
              : "h-11 px-3",
          )}
          onClick={() => setIsCreateOpen(true)}
        >
          <PlusIcon className={isFabTrigger ? "size-6" : "size-4"} />
          {isFabTrigger ? <span className="sr-only">New gear item</span> : "New"}
        </button>
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Create gear item</DrawerTitle>
          </DrawerHeader>
          {createForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isCreateOpen}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        onClick={() => setIsCreateOpen(true)}
      >
        <PlusIcon className="size-4" />
        New
      </button>
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Create gear item</SheetTitle>
        </SheetHeader>
        {createForm}
      </SheetContent>
    </Sheet>
  )
}

export function EditGearDialog({
  gearItem,
  scope,
  selectedType,
  selectedStatusFilter,
  selectedCondition,
  selectedAlert,
  currentPage,
  loadMoreMode = false,
  gearTypeOptions,
  gearStatusOptions,
  gearConditionOptions,
  open,
  onOpenChange,
  hideTrigger = false,
  surface = "sheet",
}: {
  gearItem: EditableGearItem
  scope: NavigationScope
  selectedType?: string
  selectedStatusFilter?: string
  selectedCondition?: string
  selectedAlert?: string
  currentPage: number
  loadMoreMode?: boolean
  gearTypeOptions: GearTypeOption[]
  gearStatusOptions: GearStatusOption[]
  gearConditionOptions: GearConditionOption[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  surface?: GearFormSurface
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isOpenControlled = typeof open === "boolean" && typeof onOpenChange === "function"
  const isEditOpen = isOpenControlled ? open : uncontrolledOpen
  const setIsEditOpen = isOpenControlled ? onOpenChange : setUncontrolledOpen
  const editForm = (
    <GearDialogForm
      initialValues={{
        id: gearItem.id,
        name: gearItem.name,
        gearType: gearItem.gearType,
        serialNumber: gearItem.serialNumber ?? "",
        barcode: gearItem.barcode ?? "",
        status: gearItem.status,
        condition: gearItem.condition,
        alertRules: mapRulesForDraft(gearItem.alertRules),
      }}
      idPrefix={`edit-gear-${gearItem.id}-${surface}`}
      submitLabel="Save"
      pendingLabel="Saving..."
      scope={scope}
      selectedType={selectedType}
      selectedStatusFilter={selectedStatusFilter}
      selectedCondition={selectedCondition}
      selectedAlert={selectedAlert}
      currentPage={currentPage}
      loadMoreMode={loadMoreMode}
      gearTypeOptions={gearTypeOptions}
      gearStatusOptions={gearStatusOptions}
      gearConditionOptions={gearConditionOptions}
      action={updateGearItemAction}
      surface={surface}
    />
  )

  if (surface === "drawer") {
    return (
      <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
        {!hideTrigger && !isOpenControlled ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isEditOpen}
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-3")}
            onClick={() => setIsEditOpen(true)}
          >
            <PencilIcon className="size-4" />
            Edit
          </button>
        ) : null}
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>Edit gear item</DrawerTitle>
          </DrawerHeader>
          {editForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
      {!hideTrigger && !isOpenControlled ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isEditOpen}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          onClick={() => setIsEditOpen(true)}
        >
          <PencilIcon className="size-4" />
          Edit
        </button>
      ) : null}
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Edit gear item</SheetTitle>
        </SheetHeader>
        {editForm}
      </SheetContent>
    </Sheet>
  )
}

function buildTwsMultiplierDrafts(input: {
  gearItem: EditableGearItem
  twsOptions: TeamGearTwsOption[]
}): GearTwsMultiplierDraft[] {
  const multiplierByOptionId = new Map(
    input.gearItem.twsMultipliers.map((multiplier) => [multiplier.optionId, multiplier]),
  )

  const optionCount = input.twsOptions.length

  return input.twsOptions.map((option, index) => {
    const multiplier = multiplierByOptionId.get(option.id)
    const defaultMultiplier = getDefaultTwsMultiplier(index + 1, optionCount)

    return {
      optionId: option.id,
      usageMinutesMultiplier: multiplier?.usageMinutesMultiplier ?? defaultMultiplier,
      usageCountMultiplier: multiplier?.usageCountMultiplier ?? defaultMultiplier,
    }
  })
}

function GearTwsMultipliersDialog({
  gearItem,
  twsOptions,
  scope,
  selectedType,
  selectedStatusFilter,
  selectedCondition,
  selectedAlert,
  currentPage,
  loadMoreMode,
  surface,
  triggerClassName,
}: {
  gearItem: EditableGearItem
  twsOptions: TeamGearTwsOption[]
  scope: NavigationScope
  selectedType?: string
  selectedStatusFilter?: string
  selectedCondition?: string
  selectedAlert?: string
  currentPage: number
  loadMoreMode: boolean
  surface: GearFormSurface
  triggerClassName?: string
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const initialDrafts = React.useMemo(
    () => buildTwsMultiplierDrafts({ gearItem, twsOptions }),
    [gearItem, twsOptions],
  )
  const [drafts, setDrafts] = React.useState<GearTwsMultiplierDraft[]>(initialDrafts)

  React.useEffect(() => {
    if (isOpen) {
      setDrafts(initialDrafts)
    }
  }, [initialDrafts, isOpen])

  function updateMultiplier(
    optionId: string,
    field: "usageMinutesMultiplier" | "usageCountMultiplier",
    rawValue: string,
  ) {
    const parsedValue = Number.parseFloat(rawValue)
    const nextValue = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0

    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.optionId === optionId
          ? {
              ...draft,
              [field]: nextValue,
            }
          : draft,
      ),
    )
  }

  const canSubmit =
    twsOptions.length > 0 &&
    drafts.every(
      (draft) =>
        Number.isFinite(draft.usageMinutesMultiplier) &&
        draft.usageMinutesMultiplier >= 0 &&
        Number.isFinite(draft.usageCountMultiplier) &&
        draft.usageCountMultiplier >= 0,
    )
  const multipliersPayload = JSON.stringify(drafts)
  const isDrawerSurface = surface === "drawer"
  const inputClassName = isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={twsOptions.length === 0}
      aria-label={`Edit TWS multipliers for ${gearItem.name}`}
      className={triggerClassName}
      onClick={() => setIsOpen(true)}
    >
      <Settings2Icon className="size-4" />
    </Button>
  )
  const form = (
    <form
      action={updateGearTwsMultipliersAction}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <input type="hidden" name="id" value={gearItem.id} />
      <GearRouteScopeHiddenFields
        scope={scope}
        selectedType={selectedType}
        selectedStatusFilter={selectedStatusFilter}
        selectedCondition={selectedCondition}
        selectedAlert={selectedAlert}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
      />
      <input type="hidden" name="multipliersPayload" value={multipliersPayload} />

      <GearDialogFields className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {twsOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active TWS options configured.</p>
        ) : (
          <div className="space-y-3">
            {twsOptions.map((option, optionIndex) => {
              const defaultMultiplier = getDefaultTwsMultiplier(optionIndex + 1, twsOptions.length)
              const draft = drafts.find((item) => item.optionId === option.id) ?? {
                optionId: option.id,
                usageMinutesMultiplier: defaultMultiplier,
                usageCountMultiplier: defaultMultiplier,
              }

              return (
                <div key={option.id} className="space-y-3 rounded-lg border p-3">
                  <p className="truncate text-sm font-medium">{option.label}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`gear-tws-${gearItem.id}-${option.id}-minutes`}>
                        Minutes
                      </Label>
                      <Input
                        id={`gear-tws-${gearItem.id}-${option.id}-minutes`}
                        type="number"
                        min={0}
                        max={9999}
                        step={0.01}
                        value={draft.usageMinutesMultiplier}
                        onChange={(event) =>
                          updateMultiplier(
                            option.id,
                            "usageMinutesMultiplier",
                            event.target.value,
                          )
                        }
                        className={inputClassName}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`gear-tws-${gearItem.id}-${option.id}-count`}>
                        Times Used
                      </Label>
                      <Input
                        id={`gear-tws-${gearItem.id}-${option.id}-count`}
                        type="number"
                        min={0}
                        max={9999}
                        step={0.01}
                        value={draft.usageCountMultiplier}
                        onChange={(event) =>
                          updateMultiplier(
                            option.id,
                            "usageCountMultiplier",
                            event.target.value,
                          )
                        }
                        className={inputClassName}
                        required
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </GearDialogFields>

      <GearDialogFooter
        submitLabel="Save"
        pendingLabel="Saving..."
        canSubmit={canSubmit}
        surface={surface}
      />
    </form>
  )

  if (surface === "drawer") {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        {trigger}
        <DrawerContent className="flex h-[85dvh] min-h-0 flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="shrink-0 border-b text-left">
            <DrawerTitle>TWS multipliers</DrawerTitle>
          </DrawerHeader>
          {form}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {trigger}
      <SheetContent side="right" className="flex h-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>TWS multipliers</SheetTitle>
        </SheetHeader>
        {form}
      </SheetContent>
    </Sheet>
  )
}

export function GearActionsMenu({
  gearItem,
  twsOptions,
  scope,
  selectedType,
  selectedStatusFilter,
  selectedCondition,
  selectedAlert,
  currentPage,
  loadMoreMode = false,
  gearTypeOptions,
  gearStatusOptions,
  gearConditionOptions,
  canManageGear,
  surface = "sheet",
  triggerClassName,
}: {
  gearItem: EditableGearItem
  twsOptions: TeamGearTwsOption[]
  scope: NavigationScope
  selectedType?: string
  selectedStatusFilter?: string
  selectedCondition?: string
  selectedAlert?: string
  currentPage: number
  loadMoreMode?: boolean
  gearTypeOptions: GearTypeOption[]
  gearStatusOptions: GearStatusOption[]
  gearConditionOptions: GearConditionOption[]
  canManageGear: boolean
  surface?: GearFormSurface
  triggerClassName?: string
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isRetiring, setIsRetiring] = React.useState(false)
  const retireFormRef = React.useRef<HTMLFormElement | null>(null)

  if (!canManageGear) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          disabled
          aria-label="TWS multipliers unavailable"
          className={triggerClassName}
        >
          <Settings2Icon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled
          aria-label="More actions unavailable"
          className={triggerClassName}
        >
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <GearTwsMultipliersDialog
        gearItem={gearItem}
        twsOptions={twsOptions}
        scope={scope}
        selectedType={selectedType}
        selectedStatusFilter={selectedStatusFilter}
        selectedCondition={selectedCondition}
        selectedAlert={selectedAlert}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        surface={surface}
        triggerClassName={triggerClassName}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isRetiring}
              aria-busy={isRetiring}
              className={triggerClassName}
            />
          }
          aria-label={`Open actions for ${gearItem.name}`}
        >
          {isRetiring ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <MoreHorizontalIcon className="size-4" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setIsEditOpen(true)
            }}
          >
            Edit
          </DropdownMenuItem>
          {gearItem.status !== "retired_spare" ? (
            <DropdownMenuItem
              disabled={isRetiring}
              onClick={() => {
                setIsRetiring(true)
                retireFormRef.current?.requestSubmit()
              }}
              className="gap-2"
            >
              {isRetiring ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {isRetiring ? "Retiring..." : "Mark Retired/Spare"}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {gearItem.status !== "retired_spare" ? (
        <form action={retireGearItemAction} ref={retireFormRef} className="hidden">
          <input type="hidden" name="id" value={gearItem.id} />
          <input type="hidden" name="nextStatus" value="retired_spare" />
          <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
          {scope.activeTeamId ? (
            <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
          ) : null}
          {selectedType ? <input type="hidden" name="scopeType" value={selectedType} /> : null}
          {selectedStatusFilter ? (
            <input type="hidden" name="scopeStatus" value={selectedStatusFilter} />
          ) : null}
          {selectedCondition ? (
            <input type="hidden" name="scopeCondition" value={selectedCondition} />
          ) : null}
          {selectedAlert ? <input type="hidden" name="scopeAlert" value={selectedAlert} /> : null}
          {currentPage > 1 ? (
            <input type="hidden" name="scopePage" value={String(currentPage)} />
          ) : null}
          {loadMoreMode && currentPage > 1 ? (
            <input type="hidden" name="scopeLoadMore" value="1" />
          ) : null}
        </form>
      ) : null}

      <EditGearDialog
        gearItem={gearItem}
        scope={scope}
        selectedType={selectedType}
        selectedStatusFilter={selectedStatusFilter}
        selectedCondition={selectedCondition}
        selectedAlert={selectedAlert}
        currentPage={currentPage}
        loadMoreMode={loadMoreMode}
        gearTypeOptions={gearTypeOptions}
        gearStatusOptions={gearStatusOptions}
        gearConditionOptions={gearConditionOptions}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        surface={surface}
        hideTrigger
      />
    </div>
  )
}
