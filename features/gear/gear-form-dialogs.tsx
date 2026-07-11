"use client"

import * as React from "react"
import {
  CameraIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useFormStatus } from "react-dom"

import {
  createGearItemAction,
  retireGearItemAction,
  updateGearItemAction,
} from "@/features/gear/actions"
import type { TeamGearAlertRuleItem, TeamGearListItem } from "@/features/gear/shared"
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
  DrawerDescription,
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type GearTypeOption = { value: string; label: string }
type GearStatusOption = { value: string; label: string }
type GearConditionOption = { value: string; label: string }
type GearFormSurface = "drawer" | "sheet"

type GearRuleDraft = {
  draftKey: string
  metric: "usage_count" | "usage_minutes"
  severity: "warning" | "critical"
  thresholdValue: number
  isRefurbishedRule: boolean
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
  "id" | "name" | "gearType" | "serialNumber" | "barcode" | "status" | "condition" | "alertRules"
>

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

function mapRulesForDraft(rules: TeamGearAlertRuleItem[]): GearRuleDraft[] {
  return rules.map((rule) => ({
    draftKey: rule.id,
    metric: rule.metric,
    severity: rule.severity,
    thresholdValue: rule.thresholdValue,
    isRefurbishedRule: rule.isRefurbishedRule,
  }))
}

let nextRuleDraftId = 0

function createRuleDraftKey(): string {
  nextRuleDraftId += 1

  return `new-rule-${nextRuleDraftId}`
}

function createDefaultRule(): GearRuleDraft {
  return {
    draftKey: createRuleDraftKey(),
    metric: "usage_minutes",
    severity: "warning",
    thresholdValue: 60,
    isRefurbishedRule: false,
  }
}

function hasInvalidRule(rule: GearRuleDraft): boolean {
  return !Number.isInteger(rule.thresholdValue) || rule.thresholdValue <= 0
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
    alertRules.every((rule) => !hasInvalidRule(rule))
  const isDrawerSurface = surface === "drawer"
  const inputClassName = isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : undefined
  const selectClassName = cn(
    "w-full rounded-lg border border-input bg-background px-3 outline-none ring-ring/50 focus-visible:ring-[3px]",
    isDrawerSurface ? "h-11 text-base md:text-sm" : "h-9 text-sm",
  )
  const compactButtonClassName = isDrawerSurface ? "h-11 px-3" : undefined
  const iconButtonClassName = isDrawerSurface ? "h-11 w-11" : undefined

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
            severity: rule.severity,
            thresholdValue: rule.thresholdValue,
            isRefurbishedRule: rule.isRefurbishedRule,
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
            <div>
              <h4 className="text-sm font-semibold">Threshold Rules</h4>
              <p className="text-xs text-muted-foreground">
                Create warning and critical thresholds by uses or minutes.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={compactButtonClassName}
              onClick={() => {
                setAlertRules((existingRules) => [...existingRules, createDefaultRule()])
              }}
            >
              <PlusIcon className="size-4" />
              Rule
            </Button>
          </div>

          {alertRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rules configured. This item will never show alerts.
            </p>
          ) : (
            <div className="space-y-3">
              {alertRules.map((rule, index) => (
                <div
                  key={rule.draftKey}
                  className="grid gap-3 rounded-md border p-3 md:grid-cols-[1.1fr_1fr_1fr_auto_auto]"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Metric</Label>
                    <select
                      value={rule.metric}
                      onChange={(event) => {
                        const nextMetric = event.target.value as GearRuleDraft["metric"]
                        setAlertRules((existingRules) => {
                          const nextRules = [...existingRules]
                          nextRules[index] = {
                            ...nextRules[index],
                            metric: nextMetric,
                          }
                          return nextRules
                        })
                      }}
                      className={selectClassName}
                    >
                      <option value="usage_minutes">Minutes</option>
                      <option value="usage_count">Times Used</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Severity</Label>
                    <select
                      value={rule.severity}
                      onChange={(event) => {
                        const nextSeverity = event.target.value as GearRuleDraft["severity"]
                        setAlertRules((existingRules) => {
                          const nextRules = [...existingRules]
                          nextRules[index] = {
                            ...nextRules[index],
                            severity: nextSeverity,
                          }
                          return nextRules
                        })
                      }}
                      className={selectClassName}
                    >
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Threshold</Label>
                    <Input
                      type="number"
                      min={1}
                      value={String(rule.thresholdValue)}
                      onChange={(event) => {
                        const nextValue = Number.parseInt(event.target.value, 10)

                        setAlertRules((existingRules) => {
                          const nextRules = [...existingRules]
                          nextRules[index] = {
                            ...nextRules[index],
                            thresholdValue: Number.isFinite(nextValue) ? nextValue : 0,
                          }
                          return nextRules
                        })
                      }}
                      className={inputClassName}
                    />
                  </div>

                  <label className="inline-flex min-h-11 items-center gap-2 pt-0 text-sm md:pt-6">
                    <input
                      type="checkbox"
                      checked={rule.isRefurbishedRule}
                      onChange={(event) => {
                        setAlertRules((existingRules) => {
                          const nextRules = [...existingRules]
                          nextRules[index] = {
                            ...nextRules[index],
                            isRefurbishedRule: event.target.checked,
                          }
                          return nextRules
                        })
                      }}
                      className="size-4 rounded border-input"
                    />
                    Refurb only
                  </label>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn("md:mt-5", iconButtonClassName)}
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
              ))}
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
            <DrawerDescription>
              Create an item and define optional usage alert thresholds.
            </DrawerDescription>
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
          <SheetDescription>
            Create an item and define optional usage alert thresholds.
          </SheetDescription>
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
            <DrawerDescription>{gearItem.name}</DrawerDescription>
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
          <SheetDescription>{gearItem.name}</SheetDescription>
        </SheetHeader>
        {editForm}
      </SheetContent>
    </Sheet>
  )
}

export function GearActionsMenu({
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
  canManageGear,
  surface = "sheet",
  triggerClassName,
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
  canManageGear: boolean
  surface?: GearFormSurface
  triggerClassName?: string
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isRetiring, setIsRetiring] = React.useState(false)
  const retireFormRef = React.useRef<HTMLFormElement | null>(null)

  if (!canManageGear) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="More actions unavailable"
        className={triggerClassName}
      >
        <MoreHorizontalIcon className="size-4" />
      </Button>
    )
  }

  return (
    <>
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
    </>
  )
}
