"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  FileImageIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  createTeamExpenseAction,
  updateTeamExpenseAction,
} from "@/features/expenses/actions"
import type {
  TeamExpenseFormOptions,
  TeamExpenseListItem,
} from "@/features/expenses/data"
import {
  addOptimisticTeamExpense,
  removeOptimisticTeamExpense,
  type OptimisticTeamExpense,
} from "@/features/expenses/optimistic-expenses"
import {
  formatCurrencyAmount,
  type ExpenseType,
} from "@/features/expenses/shared"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const RECEIPT_MAX_DIMENSION = 720
const RECEIPT_MAX_BYTES = 2 * 1024 * 1024
const RECEIPT_THUMBNAIL_MAX_DIMENSION = 320
const RECEIPT_THUMBNAIL_MAX_BYTES = 256 * 1024
const RECEIPT_WEBP_TYPE = "image/webp"
const RECEIPT_QUALITY_LADDER = [0.55, 0.48, 0.42] as const
const RECEIPT_THUMBNAIL_QUALITY_LADDER = [0.5, 0.44, 0.38] as const
const OPTIMISTIC_EXPENSE_SETTLE_DELAY_MS = 2_500

type ExpenseFormSurface = "drawer" | "sheet"
type ExpenseFormMode = "create" | "edit"
type ReceiptAttachmentState = "idle" | "uploading" | "processing" | "error" | "done"

type DecodedReceiptImageSource = {
  cleanup: () => void
  height: number
  source: CanvasImageSource
  width: number
}

type CompressedReceiptFiles = {
  receiptFile: File
  thumbnailFile: File
}

function buildCompressedReceiptFileName(fileName: string, suffix = ""): string {
  const normalizedName = fileName.trim()
  const baseName =
    normalizedName.length > 0
      ? normalizedName.replace(/\.[^/.]+$/, "")
      : "receipt"

  return `${baseName || "receipt"}${suffix}.webp`
}

async function decodeReceiptImageSource(file: File): Promise<DecodedReceiptImageSource> {
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
      reject(new Error("Could not read this receipt image."))
    }
    image.src = objectUrl
  })
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress this receipt image."))
          return
        }

        resolve(blob)
      },
      RECEIPT_WEBP_TYPE,
      quality,
    )
  })
}

async function encodeReceiptImageFile(input: {
  decodedImage: DecodedReceiptImageSource
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
    throw new Error("Could not prepare this receipt image.")
  }

  context.drawImage(input.decodedImage.source, 0, 0, targetWidth, targetHeight)

  let compressedBlob: Blob | null = null

  for (const quality of input.qualityLadder) {
    compressedBlob = await canvasToWebpBlob(canvas, quality)

    if (compressedBlob.size <= input.maxBytes) {
      break
    }
  }

  if (!compressedBlob || compressedBlob.size > input.maxBytes) {
    throw new Error("This receipt image is still too large after compression.")
  }

  return new File(
    [compressedBlob],
    buildCompressedReceiptFileName(input.fileName, input.suffix),
    {
      type: RECEIPT_WEBP_TYPE,
      lastModified: Date.now(),
    },
  )
}

async function compressReceiptFiles(file: File): Promise<CompressedReceiptFiles> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Select an image file.")
  }

  const decodedImage = await decodeReceiptImageSource(file)

  try {
    const receiptFile = await encodeReceiptImageFile({
      decodedImage,
      fileName: file.name,
      maxBytes: RECEIPT_MAX_BYTES,
      maxDimension: RECEIPT_MAX_DIMENSION,
      qualityLadder: RECEIPT_QUALITY_LADDER,
    })
    const thumbnailFile = await encodeReceiptImageFile({
      decodedImage,
      fileName: file.name,
      maxBytes: RECEIPT_THUMBNAIL_MAX_BYTES,
      maxDimension: RECEIPT_THUMBNAIL_MAX_DIMENSION,
      qualityLadder: RECEIPT_THUMBNAIL_QUALITY_LADDER,
      suffix: "-thumb",
    })

    return {
      receiptFile,
      thumbnailFile,
    }
  } finally {
    decodedImage.cleanup()
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function defaultDateValue(selectedYear?: number): string {
  const now = new Date()
  const targetYear = selectedYear ?? now.getFullYear()
  const targetMonth = now.getMonth()
  const targetDate = new Date(targetYear, targetMonth, now.getDate())

  if (targetDate.getMonth() !== targetMonth) {
    targetDate.setDate(0)
  }

  const month = String(targetDate.getMonth() + 1).padStart(2, "0")
  const day = String(targetDate.getDate()).padStart(2, "0")

  return `${targetDate.getFullYear()}-${month}-${day}`
}

function getInitialExpenseValue(input: {
  expense: TeamExpenseListItem | null
  key: keyof TeamExpenseListItem
  fallback?: string
}): string {
  const value = input.expense?.[input.key]

  if (typeof value === "number") {
    return String(value)
  }

  if (typeof value === "string") {
    return value
  }

  return input.fallback ?? ""
}

function getCurrencySymbol(currencyCode: string): string {
  try {
    const currencyPart = new Intl.NumberFormat("en-US", {
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      style: "currency",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")

    return currencyPart?.value ?? currencyCode
  } catch {
    return currencyCode
  }
}

function buildOptimisticExpenseId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `optimistic-expense-${crypto.randomUUID()}`
  }

  return `optimistic-expense-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getFormDataString(formData: FormData, key: string): string {
  const value = formData.get(key)

  return typeof value === "string" ? value : ""
}

function buildOptimisticTeamExpense(input: {
  formData: FormData
  options: TeamExpenseFormOptions
  receiptFile: File | null
  scope: NavigationScope
}): OptimisticTeamExpense | null {
  if (!input.scope.activeTeamId) {
    return null
  }

  const teamVenueId = getFormDataString(input.formData, "teamVenueId")
  const expenseDate = getFormDataString(input.formData, "expenseDate")
  const assignedToProfileId = getFormDataString(input.formData, "assignedToProfileId")
  const amountLocal = Number.parseFloat(getFormDataString(input.formData, "amountLocal"))
  const currencyCode =
    getFormDataString(input.formData, "currencyCode") || input.options.organizationCurrencyCode
  const expenseType = getFormDataString(input.formData, "expenseType") as ExpenseType
  const venueOption = input.options.venueOptions.find(
    (option) => option.teamVenueId === teamVenueId,
  )
  const memberOption = input.options.memberOptions.find(
    (option) => option.profileId === assignedToProfileId,
  )
  const vendor = getFormDataString(input.formData, "vendor").trim()

  if (
    !teamVenueId ||
    !venueOption ||
    !expenseDate ||
    !assignedToProfileId ||
    !Number.isFinite(amountLocal) ||
    amountLocal <= 0 ||
    !vendor
  ) {
    return null
  }

  const amountLabel = formatCurrencyAmount({
    amount: amountLocal,
    currencyCode,
  })

  return {
    amountLabel,
    amountLocal,
    assignedMemberName:
      memberOption?.label ??
      (assignedToProfileId === input.options.defaultAssignedToProfileId
        ? "You"
        : "Selected member"),
    assignedToProfileId,
    convertedAmountLabel:
      currencyCode === input.options.organizationCurrencyCode ? amountLabel : "Converting...",
    currencyCode,
    description: getFormDataString(input.formData, "description").trim() || null,
    expenseDate,
    expenseType,
    expenseYear: Number.parseInt(expenseDate.slice(0, 4), 10),
    id: buildOptimisticExpenseId(),
    receiptFileName: input.receiptFile?.name ?? null,
    scopeOrgId: input.scope.activeOrgId,
    scopeTeamId: input.scope.activeTeamId,
    teamVenueId,
    vendor,
    venueName: venueOption.venueName,
  }
}

function ExpenseFormFields({
  defaultExpenseDate,
  disabled,
  expense,
  fileInputRef,
  lockedTeamVenueId,
  mode,
  onReceiptFileChange,
  onReceiptFileRemove,
  options,
  receiptAttachmentState,
  selectedReceiptFile,
  selectedVenueId,
  setSelectedVenueId,
  surface,
}: {
  defaultExpenseDate: string
  disabled: boolean
  expense: TeamExpenseListItem | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  lockedTeamVenueId?: string
  mode: ExpenseFormMode
  onReceiptFileChange: (file: File | null) => void
  onReceiptFileRemove: () => void
  options: TeamExpenseFormOptions
  receiptAttachmentState: ReceiptAttachmentState
  selectedReceiptFile: File | null
  selectedVenueId: string
  setSelectedVenueId: (value: string) => void
  surface: ExpenseFormSurface
}) {
  const selectedVenueOption = options.venueOptions.find(
    (option) => option.teamVenueId === selectedVenueId,
  )
  const assignedToProfileId =
    expense?.assignedToProfileId ?? options.defaultAssignedToProfileId
  const initialCurrencyCode = expense?.currencyCode ?? options.organizationCurrencyCode
  const [selectedCurrencyCode, setSelectedCurrencyCode] =
    React.useState(initialCurrencyCode)

  React.useEffect(() => {
    setSelectedCurrencyCode(initialCurrencyCode)
  }, [initialCurrencyCode])

  const selectedCurrencySymbol = getCurrencySymbol(selectedCurrencyCode)
  const isDrawerSurface = surface === "drawer"
  const isMobile = useIsMobile()

  function keepMobileFieldVisible(event: React.FocusEvent<HTMLElement>) {
    if (!isDrawerSurface || !isMobile) {
      return
    }

    const target = event.currentTarget

    window.setTimeout(() => {
      target.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      })
    }, 120)
  }

  const inputClassName = isDrawerSurface
    ? "h-11 scroll-my-8 px-3 text-base md:text-sm"
    : undefined
  const selectClassName = cn(
    "w-full rounded-lg border border-input bg-background text-sm outline-none ring-ring/50 focus-visible:ring-[3px]",
    isDrawerSurface ? "h-11 scroll-my-8 px-3 text-base md:text-sm" : "h-9 px-3",
  )
  const lockedVenueClassName = cn(
    "flex items-center rounded-lg border border-input bg-muted/30",
    isDrawerSurface ? "h-11 px-3 text-base md:text-sm" : "h-9 px-3 text-sm",
  )
  const amountControlClassName = cn(
    "flex w-full items-center overflow-hidden rounded-lg border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
    isDrawerSurface ? "h-11 text-base md:text-sm" : "h-9 text-sm",
  )
  const amountInputClassName = cn(
    "h-full min-w-0 flex-1 rounded-none border-0 bg-transparent py-0 focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent",
    isDrawerSurface ? "scroll-my-8 px-2.5 text-base md:text-sm" : "px-2.5 text-sm",
  )
  const currencySelectClassName = cn(
    "h-full cursor-pointer appearance-none bg-transparent py-0 pl-3 text-center font-medium text-foreground outline-none",
    isDrawerSurface
      ? "min-w-24 scroll-my-8 pr-8 text-base md:text-sm"
      : "min-w-20 pr-7 text-sm",
  )

  return (
    <fieldset disabled={disabled} className="grid gap-4 disabled:pointer-events-none disabled:opacity-70">
      {mode === "edit" && expense ? (
        <input type="hidden" name="expenseId" value={expense.id} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expense-date">Date</Label>
          <Input
            id="expense-date"
            name="expenseDate"
            type="date"
            required
            defaultValue={getInitialExpenseValue({
              expense,
              key: "expenseDate",
              fallback: defaultExpenseDate,
            })}
            className={inputClassName}
            onFocus={keepMobileFieldVisible}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-type">Type</Label>
          <select
            id="expense-type"
            name="expenseType"
            required
            defaultValue={expense?.expenseType ?? "meals"}
            className={selectClassName}
            onFocus={keepMobileFieldVisible}
          >
            {options.typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!options.canAssignMembers ? (
        <input type="hidden" name="assignedToProfileId" value={assignedToProfileId} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {lockedTeamVenueId ? (
          <div className={cn("space-y-2", !options.canAssignMembers && "sm:col-span-2")}>
            <Label>Venue</Label>
            <input type="hidden" name="teamVenueId" value={lockedTeamVenueId} />
            <div className={lockedVenueClassName}>
              {selectedVenueOption?.venueName ?? "Selected venue"}
            </div>
          </div>
        ) : (
          <div className={cn("space-y-2", !options.canAssignMembers && "sm:col-span-2")}>
            <Label htmlFor="expense-venue">Venue</Label>
            <select
              id="expense-venue"
              name="teamVenueId"
              required
              value={selectedVenueId}
              onChange={(event) => setSelectedVenueId(event.currentTarget.value)}
              className={selectClassName}
              onFocus={keepMobileFieldVisible}
            >
              <option value="">Select venue</option>
              {options.venueOptions.map((option) => (
                <option key={option.teamVenueId} value={option.teamVenueId}>
                  {option.venueName}
                </option>
              ))}
            </select>
          </div>
        )}

        {options.canAssignMembers ? (
          <div className="space-y-2">
            <Label htmlFor="expense-member">Member</Label>
            <select
              id="expense-member"
              name="assignedToProfileId"
              required
              defaultValue={expense?.assignedToProfileId ?? ""}
              className={selectClassName}
              onFocus={keepMobileFieldVisible}
            >
              <option value="">Select member</option>
              {options.memberOptions.map((option) => (
                <option key={option.profileId} value={option.profileId}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-amount">Amount</Label>
        <div className={amountControlClassName}>
          <span className="shrink-0 pl-3 text-muted-foreground">
            {selectedCurrencySymbol}
          </span>
          <Input
            id="expense-amount"
            name="amountLocal"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            required
            defaultValue={getInitialExpenseValue({
              expense,
              key: "amountLocal",
            })}
            className={amountInputClassName}
            onFocus={keepMobileFieldVisible}
          />
          <div className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
          <div className="relative h-full shrink-0">
            <select
              id="expense-currency"
              name="currencyCode"
              required
              value={selectedCurrencyCode}
              aria-label="Currency"
              onChange={(event) => setSelectedCurrencyCode(event.currentTarget.value)}
              className={currencySelectClassName}
              onFocus={keepMobileFieldVisible}
            >
              {options.currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-vendor">Vendor</Label>
        <Input
          id="expense-vendor"
          name="vendor"
          required
          maxLength={160}
          defaultValue={expense?.vendor ?? ""}
          className={inputClassName}
          onFocus={keepMobileFieldVisible}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-description">Description</Label>
        <Textarea
          id="expense-description"
          name="description"
          maxLength={1000}
          defaultValue={expense?.description ?? ""}
          className={cn(
            "min-h-24 text-base md:text-sm",
            isDrawerSurface && "scroll-my-8",
          )}
          onFocus={keepMobileFieldVisible}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-receipt">Receipt photo</Label>
        <input
          ref={fileInputRef}
          id="expense-receipt"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            onReceiptFileChange(event.currentTarget.files?.[0] ?? null)
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-start"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon className="size-4" />
          Choose File
        </Button>
        {selectedReceiptFile ? (
          <Attachment state={receiptAttachmentState} className="w-full">
            <AttachmentMedia>
              {receiptAttachmentState === "processing" ||
              receiptAttachmentState === "uploading" ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <FileImageIcon className="size-4" />
              )}
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{selectedReceiptFile.name}</AttachmentTitle>
              <AttachmentDescription>
                {formatFileSize(selectedReceiptFile.size)}
              </AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction
                type="button"
                disabled={disabled}
                onClick={onReceiptFileRemove}
                aria-label="Remove selected receipt"
              >
                <XIcon className="size-3" />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        ) : expense?.receiptFileName ? (
          <Attachment state="done" className="w-full">
            <AttachmentMedia>
              <FileImageIcon className="size-4" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{expense.receiptFileName}</AttachmentTitle>
              <AttachmentDescription>Current receipt</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        ) : null}
      </div>
    </fieldset>
  )
}

function ExpenseSubmitButton({
  disabled,
  isSaving,
  mode,
  surface,
}: {
  disabled: boolean
  isSaving: boolean
  mode: ExpenseFormMode
  surface: ExpenseFormSurface
}) {
  const className = surface === "drawer" ? "h-11 w-full" : undefined
  const size = surface === "drawer" ? "default" : "sm"

  return (
    <Button type="submit" size={size} disabled={disabled || isSaving} className={className}>
      {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {isSaving ? "Saving..." : mode === "create" ? "Create expense" : "Save"}
    </Button>
  )
}

function ExpenseFormFooter({
  disabled,
  isSaving,
  mode,
  surface,
}: {
  disabled: boolean
  isSaving: boolean
  mode: ExpenseFormMode
  surface: ExpenseFormSurface
}) {
  const button = (
    <ExpenseSubmitButton
      disabled={disabled}
      isSaving={isSaving}
      mode={mode}
      surface={surface}
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

function ExpenseFormBody({
  defaultTeamVenueId,
  expense,
  lockTeamVenue,
  mode,
  onOpenChange,
  options,
  scope,
  selectedYear,
  surface,
}: {
  defaultTeamVenueId?: string
  expense: TeamExpenseListItem | null
  lockTeamVenue: boolean
  mode: ExpenseFormMode
  onOpenChange: (open: boolean) => void
  options: TeamExpenseFormOptions
  scope: NavigationScope
  selectedYear?: number
  surface: ExpenseFormSurface
}) {
  const router = useRouter()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [selectedReceiptFile, setSelectedReceiptFile] = React.useState<File | null>(null)
  const [receiptAttachmentState, setReceiptAttachmentState] =
    React.useState<ReceiptAttachmentState>("idle")
  const defaultVenueIsAvailable =
    defaultTeamVenueId &&
    options.venueOptions.some((option) => option.teamVenueId === defaultTeamVenueId)
  const [selectedVenueId, setSelectedVenueId] = React.useState(
    expense?.teamVenueId ??
      (defaultVenueIsAvailable ? defaultTeamVenueId : undefined) ??
      (lockTeamVenue ? options.venueOptions[0]?.teamVenueId : undefined) ??
      "",
  )
  const defaultExpenseDate = defaultDateValue(selectedYear)
  const disabled =
    isSaving ||
    options.venueOptions.length === 0 ||
    (options.canAssignMembers && options.memberOptions.length === 0) ||
    (!options.canAssignMembers && options.defaultAssignedToProfileId.length === 0)

  function resetReceiptInput(): void {
    setSelectedReceiptFile(null)
    setReceiptAttachmentState("idle")

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    if (isSaving) {
      return
    }

    setIsSaving(true)

    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set("scopeOrgId", scope.activeOrgId)

    if (scope.activeTeamId) {
      formData.set("scopeTeamId", scope.activeTeamId)
    }

    const optimisticExpense =
      mode === "create"
        ? buildOptimisticTeamExpense({
            formData,
            options,
            receiptFile: selectedReceiptFile,
            scope,
          })
        : null
    const optimisticExpenseId = optimisticExpense
      ? addOptimisticTeamExpense(optimisticExpense)
      : null

    onOpenChange(false)

    if (selectedReceiptFile) {
      try {
        setReceiptAttachmentState("processing")
        const compressedReceipt = await compressReceiptFiles(selectedReceiptFile)
        setReceiptAttachmentState("uploading")
        formData.set("receiptFile", compressedReceipt.receiptFile)
        formData.set("receiptThumbnailFile", compressedReceipt.thumbnailFile)
      } catch (error) {
        setReceiptAttachmentState("error")
        if (optimisticExpenseId) {
          removeOptimisticTeamExpense(optimisticExpenseId)
        }
        toast.error(
          error instanceof Error ? error.message : "Could not prepare receipt image.",
        )
        onOpenChange(true)
        setIsSaving(false)
        return
      }
    }

    const result =
      mode === "create"
        ? await createTeamExpenseAction(formData)
        : await updateTeamExpenseAction(formData)

    if (!result.ok) {
      if (selectedReceiptFile) {
        setReceiptAttachmentState("error")
      }
      if (optimisticExpenseId) {
        removeOptimisticTeamExpense(optimisticExpenseId)
      }
      toast.error(result.message)
      onOpenChange(true)
      setIsSaving(false)
      return
    }

    toast.success(result.message)
    router.refresh()
    resetReceiptInput()
    if (optimisticExpenseId) {
      window.setTimeout(() => {
        removeOptimisticTeamExpense(optimisticExpenseId)
      }, OPTIMISTIC_EXPENSE_SETTLE_DELAY_MS)
    }
    setIsSaving(false)
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="contents">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <ExpenseFormFields
          defaultExpenseDate={defaultExpenseDate}
          disabled={disabled}
          expense={expense}
          fileInputRef={fileInputRef}
          lockedTeamVenueId={lockTeamVenue ? selectedVenueId : undefined}
          mode={mode}
          onReceiptFileChange={(file) => {
            setSelectedReceiptFile(file)
            setReceiptAttachmentState("idle")
          }}
          onReceiptFileRemove={resetReceiptInput}
          options={options}
          receiptAttachmentState={receiptAttachmentState}
          selectedReceiptFile={selectedReceiptFile}
          selectedVenueId={selectedVenueId}
          setSelectedVenueId={setSelectedVenueId}
          surface={surface}
        />
      </div>

      <ExpenseFormFooter
        disabled={disabled}
        isSaving={isSaving}
        mode={mode}
        surface={surface}
      />
    </form>
  )
}

function ExpenseDialogTrigger({
  disabled,
  mode,
  onClick,
  open,
  triggerVariant,
}: {
  disabled?: boolean
  mode: ExpenseFormMode
  onClick: () => void
  open: boolean
  triggerVariant?: "button" | "fab" | "icon"
}) {
  if (triggerVariant === "fab") {
    return (
      <Button
        type="button"
        size="icon"
        disabled={disabled}
        className="mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
        aria-label="New expense"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onClick}
      >
        <PlusIcon className="size-6" />
      </Button>
    )
  }

  if (triggerVariant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onClick}
      >
        <PencilIcon className="size-4" />
        <span className="sr-only">Edit expense</span>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={mode === "create" ? "outline" : "ghost"}
      size="sm"
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
    >
      {mode === "create" ? <PlusIcon className="size-4" /> : <PencilIcon className="size-4" />}
      {mode === "create" ? "New" : "Edit"}
    </Button>
  )
}

export function ExpenseFormDialog({
  defaultTeamVenueId,
  disabled,
  expense = null,
  hideTrigger = false,
  lockTeamVenue = false,
  mode,
  onOpenChange,
  open,
  options,
  scope,
  selectedYear,
  surface,
  triggerVariant = "button",
}: {
  defaultTeamVenueId?: string
  disabled?: boolean
  expense?: TeamExpenseListItem | null
  hideTrigger?: boolean
  lockTeamVenue?: boolean
  mode: ExpenseFormMode
  onOpenChange?: (open: boolean) => void
  open?: boolean
  options: TeamExpenseFormOptions
  scope: NavigationScope
  selectedYear?: number
  surface: ExpenseFormSurface
  triggerVariant?: "button" | "fab" | "icon"
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isOpenControlled = typeof open === "boolean" && typeof onOpenChange === "function"
  const isOpen = isOpenControlled ? open : uncontrolledOpen
  const setIsOpen = isOpenControlled ? onOpenChange : setUncontrolledOpen
  const title = mode === "create" ? "New expense" : "Edit expense"

  if (surface === "drawer") {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        {!hideTrigger ? (
          <ExpenseDialogTrigger
            disabled={disabled}
            mode={mode}
            open={isOpen}
            triggerVariant={triggerVariant}
            onClick={() => setIsOpen(true)}
          />
        ) : null}
        <DrawerContent className="flex max-h-[85dvh] min-h-0 flex-col overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
          <DrawerHeader className="px-4 sm:px-5">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <ExpenseFormBody
              defaultTeamVenueId={defaultTeamVenueId}
              expense={expense}
              lockTeamVenue={lockTeamVenue}
              mode={mode}
              onOpenChange={setIsOpen}
              options={options}
              scope={scope}
              selectedYear={selectedYear}
              surface="drawer"
            />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {!hideTrigger ? (
        <ExpenseDialogTrigger
          disabled={disabled}
          mode={mode}
          open={isOpen}
          triggerVariant={triggerVariant}
          onClick={() => setIsOpen(true)}
        />
      ) : null}
      <SheetContent side="right" className="flex h-full flex-col overflow-hidden sm:max-w-xl">
        <SheetHeader className="px-4 sm:px-5">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <ExpenseFormBody
            defaultTeamVenueId={defaultTeamVenueId}
            expense={expense}
            lockTeamVenue={lockTeamVenue}
            mode={mode}
            onOpenChange={setIsOpen}
            options={options}
            scope={scope}
            selectedYear={selectedYear}
            surface="sheet"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
