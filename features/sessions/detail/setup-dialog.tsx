"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  createTeamSetupMetricAction,
  deleteTeamSetupMetricAction,
  saveSessionSetupAction,
  updateSessionSetupAction,
  updateTeamSetupMetricAction,
} from "@/features/sessions/actions"
import type { SessionSetupDialogItem } from "@/features/sessions/detail-types"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"

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

function hasSetupItemValue(item: SessionSetupDialogItem): boolean {
  if (item.inputKind === "text") {
    return item.textValue.trim().length > 0
  }

  return item.selectedOptions.length > 0
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

function SetupDialogFooter(input: {
  isEditMode: boolean
  isSaving: boolean
  onEnterEditMode: () => void
  surface: "drawer" | "sheet"
}) {
  const { pending } = useFormStatus()
  const isPending = pending || input.isSaving
  const drawerButtonClassName = input.surface === "drawer" ? "h-11 w-full" : undefined
  const buttonSize = input.surface === "drawer" ? "default" : "sm"

  const content = (
    <>
      {!input.isEditMode ? (
        <Button
          key="setup-edit"
          type="button"
          variant="outline"
          size={buttonSize}
          className={drawerButtonClassName}
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
          className={drawerButtonClassName}
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

  return <fieldset disabled={pending} className="m-0 space-y-4 border-0 p-0">{props.children}</fieldset>
}

function EditSetupMetricSubmitButton(props: { className?: string }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className={props.className}>
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

export function SetupDialog(input: {
  sessionId: string
  scope: NavigationScope
  items: SessionSetupDialogItem[]
  isLoading?: boolean
  loadError?: string | null
  onOpen?: () => void
  onRetry?: () => void
}) {
  const [setupItems, setSetupItems] = React.useState<SessionSetupDialogItem[]>(input.items)
  const groupedItems = React.useMemo(() => groupSetupItems(setupItems), [setupItems])
  const valuedGroupedItems = React.useMemo(
    () => groupSetupItems(setupItems.filter(hasSetupItemValue)),
    [setupItems],
  )
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
  const metricDialogPortalContainerRef = React.useRef<HTMLDivElement | null>(null)

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
  const visibleWeatherItems = isEditMode ? groupedItems.weather : valuedGroupedItems.weather
  const visibleBoatItems = isEditMode ? groupedItems.boat : valuedGroupedItems.boat
  const hasReadOnlySetupValues =
    valuedGroupedItems.weather.length > 0 || valuedGroupedItems.boat.length > 0

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
    if (nextOpen) {
      input.onOpen?.()
    }
    resetDialogState()
  }

  async function handleSetupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isEditMode || isSavingSetup) {
      return
    }

    if (setupPayloadEntries.length === 0) {
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
  }) {
    const hint = renderFieldHint(inputRow.item)

    return (
      <div
        key={inputRow.item.id}
        className="space-y-3 rounded-lg"
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
                size="icon-lg"
                className={isMobile ? "size-10 rounded-xl" : undefined}
                aria-label={`Edit setup metric ${inputRow.item.label}`}
                onClick={() => openEditMetricDialog(inputRow.item)}
              >
                <PencilIcon />
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

  const setupLoadState = input.isLoading ? (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-center">
      <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Loading Setup</p>
        <p className="text-sm text-muted-foreground">Fetching the current setup metrics.</p>
      </div>
    </div>
  ) : input.loadError ? (
    <div
      role="alert"
      className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-center"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">Could not load Setup.</p>
        <p className="text-sm text-muted-foreground">{input.loadError}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={input.onRetry}>
        Retry
      </Button>
    </div>
  ) : null

  const setupForm = (
    <form
      action={updateSessionSetupAction}
      onSubmit={handleSetupSubmit}
      className="flex min-h-0 flex-1 flex-col"
    >
          <SetupScopeHiddenFields sessionId={input.sessionId} scope={input.scope} />
          <input type="hidden" name="setupPayload" value={payloadValue} />

          <SetupDialogFieldset isSaving={isSavingSetup}>
            <div className="no-scrollbar h-full space-y-6 overflow-y-auto px-4 pb-4 pr-5">
              {setupLoadState ? (
                setupLoadState
              ) : setupItems.length === 0 ? (
                <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No setup metrics are configured for this team yet.
                </div>
              ) : !isEditMode && !hasReadOnlySetupValues ? (
                <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No setup values recorded yet.
                </div>
              ) : (
                <>
                  {visibleWeatherItems.length > 0
                    ? renderSection(
                        "Weather",
                        <div className="space-y-3">
                          {visibleWeatherItems.map((item) => {
                            if (isEditMode) {
                              return renderEditableMetricRow({
                                item,
                                showTemplateControls: false,
                              })
                            }

                            return (
                              <div key={item.id} className="rounded-lg border p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-sm font-medium">{item.label}</p>
                                  <div className="min-w-0 flex-1 text-right">
                                    {renderReadOnlyField(item)}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>,
                      )
                    : null}

                  {isEditMode || visibleBoatItems.length > 0
                    ? renderSection(
                        "Boat",
                        <div className="space-y-3">
                          {groupedItems.boat.length === 0 ? (
                            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                              No Boat metrics configured for this team yet.
                            </div>
                          ) : isEditMode ? (
                            <div className="space-y-3">
                              {orderedBoatItems.map((item) =>
                                renderEditableMetricRow({
                                  item,
                                  showTemplateControls: true,
                                }),
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {visibleBoatItems.map((item) => (
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
                      )
                    : null}

                  {isEditMode ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={`w-full border-dashed ${isMobile ? "h-11" : ""}`}
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

          {setupLoadState ? null : (
            <SetupDialogFooter
              isEditMode={isEditMode}
              isSaving={isSavingSetup}
              onEnterEditMode={() => setIsEditMode(true)}
              surface={isMobile ? "drawer" : "sheet"}
            />
          )}
        </form>
  )

  const setupSurface = isMobile ? (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="outline"
        size="default"
        className="h-9 px-3"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => handleOpenChange(true)}
      >
        Setup
      </Button>
      <DrawerContent className="h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
        <div ref={metricDialogPortalContainerRef} />
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
        <div ref={metricDialogPortalContainerRef} />
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
          <DialogContent
            className="max-h-[calc(85dvh-2rem)] overflow-y-auto sm:max-w-lg"
            portalContainer={metricDialogPortalContainerRef}
          >
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
                    className={isMobile ? "h-11" : undefined}
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
                    className={isMobile ? "h-11" : undefined}
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
                    className={isMobile ? "h-11" : undefined}
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
                    className={isMobile ? "h-11" : undefined}
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
                      className="max-h-56 overflow-y-auto [field-sizing:fixed]"
                      rows={6}
                      placeholder={"Option A\nOption B\nOption C"}
                    />
                  </div>
                ) : null}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className={isMobile ? "h-11" : undefined}
                    onClick={() => {
                      setCreateMetricStep("kind")
                      setCreateMetricKind(null)
                    }}
                  >
                    Back
                  </Button>
                  <Button type="submit" className={isMobile ? "h-11" : undefined}>
                    Create metric
                  </Button>
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
          <DialogContent
            className="max-h-[calc(85dvh-2rem)] overflow-y-auto sm:max-w-lg"
            portalContainer={metricDialogPortalContainerRef}
          >
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
                    className={isMobile ? "h-11" : undefined}
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
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none ring-ring/50 focus-visible:ring-[3px] md:text-sm"
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
                      className="max-h-56 overflow-y-auto [field-sizing:fixed]"
                      rows={6}
                      placeholder={"Option A\nOption B\nOption C"}
                    />
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="destructive"
                    className={isMobile ? "h-11" : undefined}
                    onClick={() => {
                      if (!editingMetric) {
                        return
                      }

                      setDeletingMetricId(editingMetric.id)
                      setEditingMetricId(null)
                    }}
                  >
                    <Trash2Icon className="size-4" />
                    Delete metric
                  </Button>
                  <EditSetupMetricSubmitButton className={isMobile ? "h-11" : undefined} />
                </div>
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
          <DialogContent
            className="max-h-[calc(85dvh-2rem)] overflow-y-auto sm:max-w-md"
            portalContainer={metricDialogPortalContainerRef}
          >
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
                <Button
                  type="submit"
                  variant="destructive"
                  className={isMobile ? "h-11" : undefined}
                >
                  Delete metric
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
    </>
  )
}

export type SetupDialogProps = Parameters<typeof SetupDialog>[0]
