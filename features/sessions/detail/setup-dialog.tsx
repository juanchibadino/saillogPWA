"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  Loader2Icon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
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
  deleteTeamSetupMetricAction,
  saveSessionSetupAction,
  updateSessionSetupAction,
  updateTeamSetupMetricAction,
} from "@/features/sessions/detail-actions"
import { invalidateSessionDetailRouteCache } from "@/features/shared/scoped-route-cache-invalidation"
import type { TeamSetupMetricActionItem } from "@/features/sessions/detail-actions"
import type { SessionSetupDialogItem } from "@/features/sessions/detail-types"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NavigationScope } from "@/lib/navigation/types"

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

type SetupMetricGroup = SessionSetupDialogItem["metricGroup"]
type SetupSurfaceView = "setup" | "weatherMetrics" | "boatMetrics"

function formatSetupInputKindLabel(kind: SessionSetupDialogItem["inputKind"]): string {
  if (kind === "single_select") {
    return "Single Select"
  }

  if (kind === "multi_select") {
    return "Multi Select"
  }

  return "Text"
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
    let overflow = fixedTotal - 100
    const reduceOptionIds = fixedOptionIds
      .filter((optionId) => optionId !== changedOptionId)
      .reverse()

    for (const optionId of reduceOptionIds) {
      if (overflow === 0) {
        break
      }

      const currentValue = nextPercentByOptionId.get(optionId) ?? 0
      const decrement = Math.min(currentValue, overflow)
      nextPercentByOptionId.set(optionId, currentValue - decrement)
      overflow -= decrement
    }

    if (overflow > 0) {
      const currentValue = nextPercentByOptionId.get(changedOptionId) ?? 0
      const decrement = Math.min(currentValue, overflow)
      nextPercentByOptionId.set(changedOptionId, currentValue - decrement)
      overflow -= decrement
    }

    fixedTotal = fixedOptionIds.reduce(
      (total, optionId) => total + (nextPercentByOptionId.get(optionId) ?? 0),
      0,
    )
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
    const addOptionIds = input.changedOptionId
      ? fixedOptionIds.filter((optionId) => optionId !== input.changedOptionId).reverse()
      : fixedOptionIds.slice().reverse()

    for (const optionId of addOptionIds) {
      if (remainder === 0) {
        break
      }

      const currentValue = nextPercentByOptionId.get(optionId) ?? 0
      const capacity = Math.max(0, 100 - currentValue)
      const increment = Math.min(capacity, remainder)
      nextPercentByOptionId.set(optionId, currentValue + increment)
      remainder -= increment
    }

    if (remainder > 0 && input.changedOptionId) {
      const currentValue = nextPercentByOptionId.get(input.changedOptionId) ?? 0
      const capacity = Math.max(0, 100 - currentValue)
      const increment = Math.min(capacity, remainder)
      nextPercentByOptionId.set(input.changedOptionId, currentValue + increment)
      remainder -= increment
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
      ...selectedOptionIds.filter((optionId) => optionId !== input.changedOptionId),
      ...(input.changedOptionId ? [input.changedOptionId] : []),
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
    .sort((left, right) => left.position - right.position)
  const boat = items
    .filter((item) => item.metricGroup === "boat")
    .sort((left, right) => left.position - right.position)

  return { weather, boat }
}

function buildSetupOrderIds(
  items: SessionSetupDialogItem[],
  metricGroup: SetupMetricGroup,
): string[] {
  return groupSetupItems(items)[metricGroup].map((item) => item.id)
}

function getSetupMetricGroupTitle(metricGroup: SetupMetricGroup): string {
  return metricGroup === "weather" ? "Weather" : "Boat"
}

function getSetupSurfaceViewForMetricGroup(metricGroup: SetupMetricGroup): SetupSurfaceView {
  return metricGroup === "weather" ? "weatherMetrics" : "boatMetrics"
}

function getSetupMetricGroupForSurfaceView(
  surfaceView: SetupSurfaceView,
): SetupMetricGroup | null {
  if (surfaceView === "weatherMetrics") {
    return "weather"
  }

  if (surfaceView === "boatMetrics") {
    return "boat"
  }

  return null
}

function canEditSetupMetricDefinition(item: SessionSetupDialogItem): boolean {
  return !item.isFixed && (!item.isRequired || item.key === "tws")
}

function hasRequiredTwsDraftSelection(input: {
  draftByItemId: SetupDraftByItemId
  items: SessionSetupDialogItem[]
}): boolean {
  const twsItem = input.items.find(
    (item) =>
      item.key === "tws" &&
      item.metricGroup === "weather" &&
      item.isRequired &&
      item.inputKind === "multi_select",
  )

  if (!twsItem || twsItem.options.length === 0) {
    return false
  }

  const draft = input.draftByItemId[twsItem.id]
  return Boolean(draft && draft.selectedOptions.length > 0)
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

function mergeUpdatedSetupMetricItem(input: {
  currentItem: SessionSetupDialogItem
  updatedItem: TeamSetupMetricActionItem
}): SessionSetupDialogItem {
  const activeOptionIds = new Set(input.updatedItem.options.map((option) => option.id))

  return {
    ...input.currentItem,
    ...input.updatedItem,
    selectedOptions:
      input.updatedItem.inputKind === "text"
        ? []
        : input.currentItem.selectedOptions.filter((selectedOption) =>
            activeOptionIds.has(selectedOption.optionId),
          ),
    textValue:
      input.updatedItem.inputKind === "text" ? input.currentItem.textValue : "",
  }
}

function mergeUpdatedSetupMetricDraft(input: {
  currentDraft: SetupDraftItem
  updatedItem: TeamSetupMetricActionItem
}): SetupDraftItem {
  const activeOptionIds = new Set(input.updatedItem.options.map((option) => option.id))

  if (input.updatedItem.inputKind === "text") {
    return {
      textValue: input.currentDraft.textValue,
      selectedOptions: [],
      twsEditedOptionIds: [],
    }
  }

  return {
    textValue: "",
    selectedOptions: input.currentDraft.selectedOptions.filter((selectedOption) =>
      activeOptionIds.has(selectedOption.optionId),
    ),
    twsEditedOptionIds: input.currentDraft.twsEditedOptionIds.filter((optionId) =>
      activeOptionIds.has(optionId),
    ),
  }
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
      className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden border-0 p-0"
    >
      {props.children}
    </fieldset>
  )
}

function EditSetupMetricFieldset(props: {
  children: React.ReactNode
  isPending: boolean
}) {
  return (
    <fieldset
      disabled={props.isPending}
      className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden border-0 p-0"
    >
      {props.children}
    </fieldset>
  )
}

function EditSetupMetricSubmitButton(props: {
  className?: string
  disabled: boolean
  isSaving: boolean
}) {
  return (
    <Button type="submit" disabled={props.disabled} className={props.className}>
      {props.isSaving ? (
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
    () => buildSetupOrderIds(setupItems, "boat"),
    [setupItems],
  )
  const setupItemById = React.useMemo(
    () =>
      new Map(
        [...groupedItems.weather, ...groupedItems.boat].map((item) => [item.id, item]),
      ),
    [groupedItems.boat, groupedItems.weather],
  )

  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)
  const [isEditMode, setIsEditMode] = React.useState(false)
  const [setupSurfaceView, setSetupSurfaceView] =
    React.useState<SetupSurfaceView>("setup")
  const [draftByItemId, setDraftByItemId] = React.useState<SetupDraftByItemId>(() =>
    buildInitialSetupDraft(input.items),
  )
  const [boatOrderIds, setBoatOrderIds] = React.useState<string[]>(initialBoatOrderIds)
  const [isSavingSetup, setIsSavingSetup] = React.useState(false)
  const previousInputItemsRef = React.useRef(input.items)

  const [editingMetricId, setEditingMetricId] = React.useState<string | null>(null)
  const [editingMetricLabel, setEditingMetricLabel] = React.useState("")
  const [editingMetricKind, setEditingMetricKind] = React.useState<
    "single_select" | "multi_select" | "text"
  >("multi_select")
  const [editingMetricOptionsText, setEditingMetricOptionsText] = React.useState("")
  const [isSavingMetric, setIsSavingMetric] = React.useState(false)
  const [isDeletingMetric, setIsDeletingMetric] = React.useState(false)
  const isMobile = useIsMobile()

  function keepMobileFieldVisible(event: React.FocusEvent<HTMLElement>) {
    if (!isMobile) {
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

  function getActiveMobileTextEntry(): HTMLElement | null {
    if (!isMobile || typeof document === "undefined") {
      return null
    }

    const activeElement = document.activeElement

    if (!(activeElement instanceof HTMLElement)) {
      return null
    }

    if (
      activeElement.matches(
        'input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]), textarea, [contenteditable="true"]',
      )
    ) {
      return activeElement
    }

    return null
  }

  function replayDisclosureClickAfterKeyboardSettles(target: HTMLElement) {
    const visualViewport = window.visualViewport
    let timeoutId = 0
    let settled = false

    function cleanup() {
      if (timeoutId !== 0) {
        window.clearTimeout(timeoutId)
      }

      visualViewport?.removeEventListener("resize", handleViewportResize)
    }

    function openDisclosure() {
      if (settled) {
        return
      }

      settled = true
      cleanup()

      window.requestAnimationFrame(() => {
        target.focus({ preventScroll: true })
        target.click()
      })
    }

    function handleViewportResize() {
      openDisclosure()
    }

    if (visualViewport) {
      visualViewport.addEventListener("resize", handleViewportResize, { once: true })
      timeoutId = window.setTimeout(openDisclosure, 260)
      return
    }

    timeoutId = window.setTimeout(openDisclosure, 180)
  }

  function deferMobileDisclosureUntilKeyboardCloses(event: React.PointerEvent<HTMLElement>) {
    const activeTextEntry = getActiveMobileTextEntry()

    if (!activeTextEntry) {
      return
    }

    const target = event.currentTarget

    if (activeTextEntry === target || target.contains(activeTextEntry)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    activeTextEntry.blur()
    target.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    })
    replayDisclosureClickAfterKeyboardSettles(target)
  }

  React.useEffect(() => {
    if (previousInputItemsRef.current === input.items) {
      return
    }

    previousInputItemsRef.current = input.items
    setSetupItems(input.items)

    if (!isOpen || !isEditMode) {
      setDraftByItemId(buildInitialSetupDraft(input.items))
      setBoatOrderIds(buildSetupOrderIds(input.items, "boat"))
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
        .map((itemId) => setupItemById.get(itemId) ?? null)
        .filter((item): item is SessionSetupDialogItem => item !== null),
    [setupItemById, boatOrderIds],
  )

  const editingMetric =
    editingMetricId !== null ? setupItemById.get(editingMetricId) ?? null : null
  const isMetricPending = isSavingMetric || isDeletingMetric
  const visibleWeatherItems = isEditMode ? groupedItems.weather : valuedGroupedItems.weather
  const visibleBoatItems = isEditMode ? groupedItems.boat : valuedGroupedItems.boat
  const hasReadOnlySetupValues =
    valuedGroupedItems.weather.length > 0 || valuedGroupedItems.boat.length > 0

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
    setBoatOrderIds(buildSetupOrderIds(setupItems, "boat"))
    setIsEditMode(false)
    setSetupSurfaceView("setup")
    setEditingMetricId(null)
    setEditingMetricLabel("")
    setEditingMetricKind("multi_select")
    setEditingMetricOptionsText("")
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

    if (!hasRequiredTwsDraftSelection({ items: setupItems, draftByItemId })) {
      toast.error("TWS is required. Select at least one TWS option before saving.", {
        id: `session-setup-save:${input.sessionId}`,
      })
      return
    }

    if (setupPayloadEntries.length === 0) {
      setIsEditMode(false)
      setSetupSurfaceView("setup")
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
    setBoatOrderIds(buildSetupOrderIds(optimisticSetupItems, "boat"))
    setIsEditMode(false)
    setSetupSurfaceView("setup")
    setIsOpen(false)
    setIsSavingSetup(true)

    try {
      const result = await saveSessionSetupAction(formData)

      if (!result.ok) {
        setSetupItems(previousSetupItems)
        setDraftByItemId(submittedDraftByItemId)
        setBoatOrderIds(submittedBoatOrderIds)
        setIsEditMode(true)
        setSetupSurfaceView("setup")
        setIsOpen(true)
        toast.error(result.message, { id: toastId })
        return
      }

      invalidateSessionDetailRouteCache({
        scope: input.scope,
        sessionId: input.sessionId,
        tabs: ["info"],
      })
      toast.success("Session setup updated successfully.", { id: toastId })
      router.refresh()
    } catch {
      setSetupItems(previousSetupItems)
      setDraftByItemId(submittedDraftByItemId)
      setBoatOrderIds(submittedBoatOrderIds)
      setIsEditMode(true)
      setSetupSurfaceView("setup")
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

  function updateTwsPercentStep(
    item: SessionSetupDialogItem,
    optionId: string,
    currentPercent: number | null,
    delta: number,
  ) {
    const currentValue = clampPercentInteger(currentPercent ?? 0)
    const currentRemainder = currentValue % 5
    const nextPercent =
      delta > 0
        ? currentRemainder === 0
          ? currentValue + 5
          : currentValue + (currentRemainder === 4 ? 10 - currentRemainder : 5 - currentRemainder)
        : currentRemainder === 0
          ? currentValue - 5
          : currentValue - currentRemainder

    updateTwsPercentValue(item, optionId, String(clampPercentInteger(nextPercent)))
  }

  function openEditMetricDialog(item: SessionSetupDialogItem) {
    if (!canEditSetupMetricDefinition(item)) {
      return
    }

    setSetupSurfaceView(getSetupSurfaceViewForMetricGroup(item.metricGroup))
    setEditingMetricId(item.id)
    setEditingMetricLabel(item.label)
    setEditingMetricKind(item.inputKind)
    setEditingMetricOptionsText(item.options.map((option) => option.label).join("\n"))
  }

  function closeMetricEditor() {
    setEditingMetricId(null)
    setEditingMetricLabel("")
    setEditingMetricKind("multi_select")
    setEditingMetricOptionsText("")
  }

  function buildMetricDeleteFormData(itemId: string): FormData {
    const formData = new FormData()

    formData.set("sessionId", input.sessionId)
    formData.set("scopeOrgId", input.scope.activeOrgId)

    if (input.scope.activeTeamId) {
      formData.set("scopeTeamId", input.scope.activeTeamId)
    }

    formData.set("scopeTab", "info")
    formData.set("itemId", itemId)

    return formData
  }

  async function handleMetricSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingMetric || isMetricPending) {
      return
    }

    const formData = new FormData(event.currentTarget)
    const toastId = `setup-metric-save:${editingMetric.id}`
    const nextSurfaceView = getSetupSurfaceViewForMetricGroup(editingMetric.metricGroup)

    setIsSavingMetric(true)

    try {
      const result = await updateTeamSetupMetricAction(formData)

      if (!result.ok) {
        toast.error(result.message, { id: toastId })
        return
      }

      setSetupItems((previousItems) =>
        previousItems.map((item) =>
          item.id === result.item.id
            ? mergeUpdatedSetupMetricItem({
                currentItem: item,
                updatedItem: result.item,
              })
            : item,
        ),
      )
      setDraftByItemId((previousDraftByItemId) => {
        const currentDraft = previousDraftByItemId[result.item.id] ?? {
          textValue: "",
          selectedOptions: [],
          twsEditedOptionIds: [],
        }

        return {
          ...previousDraftByItemId,
          [result.item.id]: mergeUpdatedSetupMetricDraft({
            currentDraft,
            updatedItem: result.item,
          }),
        }
      })
      closeMetricEditor()
      setSetupSurfaceView(nextSurfaceView)
      input.onRetry?.()
      invalidateSessionDetailRouteCache({
        scope: input.scope,
        sessionId: input.sessionId,
        tabs: ["info"],
      })
      router.refresh()
      toast.success("Setup metric updated.", { id: toastId })
    } catch {
      toast.error("Could not update this session setup. Confirm permissions and try again.", {
        id: toastId,
      })
    } finally {
      setIsSavingMetric(false)
    }
  }

  async function handleMetricDelete() {
    if (!editingMetric || isMetricPending) {
      return
    }

    if (editingMetric.isRequired) {
      toast.error("TWS is required and cannot be deleted.", {
        id: `setup-metric-delete:${editingMetric.id}`,
      })
      return
    }

    const formData = buildMetricDeleteFormData(editingMetric.id)
    const toastId = `setup-metric-delete:${editingMetric.id}`
    const nextSurfaceView = getSetupSurfaceViewForMetricGroup(editingMetric.metricGroup)

    setIsDeletingMetric(true)

    try {
      const result = await deleteTeamSetupMetricAction(formData)

      if (!result.ok) {
        toast.error(result.message, { id: toastId })
        return
      }

      setSetupItems((previousItems) =>
        previousItems.filter((item) => item.id !== result.itemId),
      )
      setDraftByItemId((previousDraftByItemId) => {
        const nextDraftByItemId = { ...previousDraftByItemId }
        delete nextDraftByItemId[result.itemId]
        return nextDraftByItemId
      })
      setBoatOrderIds((previousOrderIds) =>
        previousOrderIds.filter((itemId) => itemId !== result.itemId),
      )
      closeMetricEditor()
      setSetupSurfaceView(nextSurfaceView)
      input.onRetry?.()
      invalidateSessionDetailRouteCache({
        scope: input.scope,
        sessionId: input.sessionId,
        tabs: ["info"],
      })
      router.refresh()
      toast.success("Setup metric deleted.", { id: toastId })
    } catch {
      toast.error("Could not update this session setup. Confirm permissions and try again.", {
        id: toastId,
      })
    } finally {
      setIsDeletingMetric(false)
    }
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
          onFocus={keepMobileFieldVisible}
          placeholder={`Enter ${item.label.toLowerCase()}`}
          className={isMobile ? "h-11 px-3" : undefined}
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
            className={isMobile ? "min-h-11 text-base" : undefined}
            onPointerDownCapture={deferMobileDisclosureUntilKeyboardCloses}
            onFocus={keepMobileFieldVisible}
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

              const currentPercent = selectedOption.allocationPercent ?? 0

              return (
                <div
                  key={selectedOption.optionId}
                  className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1"
                >
                  <span className="truncate text-xs text-muted-foreground">{option.label}</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={isMobile ? "h-11 w-11 rounded-xl" : "size-8 rounded-xl"}
                      disabled={currentPercent <= 0}
                      aria-label={`Decrease ${option.label} by 5 percent`}
                      onClick={() =>
                        updateTwsPercentStep(item, selectedOption.optionId, currentPercent, -5)
                      }
                    >
                      <MinusIcon className="size-4" />
                    </Button>
                    <div
                      className={
                        isMobile
                          ? "flex h-11 w-16 items-center justify-center rounded-xl border bg-muted px-2 text-sm font-medium text-muted-foreground"
                          : "flex h-8 w-14 items-center justify-center rounded-xl border bg-muted px-2 text-sm font-medium text-muted-foreground"
                      }
                    >
                      {currentPercent}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={isMobile ? "h-11 w-11 rounded-xl" : "size-8 rounded-xl"}
                      disabled={currentPercent >= 100}
                      aria-label={`Increase ${option.label} by 5 percent`}
                      onClick={() =>
                        updateTwsPercentStep(item, selectedOption.optionId, currentPercent, 5)
                      }
                    >
                      <PlusIcon className="size-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
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

  function renderEditableMetricRow(item: SessionSetupDialogItem) {
    const hint = renderFieldHint(item)

    return (
      <div key={item.id} className="space-y-3 rounded-lg">
        <Label
          htmlFor={`setup-item-${item.id}`}
          className="min-w-0 text-xs uppercase text-muted-foreground"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="block truncate">{item.label}</span>
            {item.isRequired ? (
              <Badge variant="outline" className="h-5 normal-case">
                Required
              </Badge>
            ) : null}
          </span>
        </Label>

        <div className="min-w-0">{renderField(item)}</div>

        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    )
  }

  function renderSetupMetricDefinitionRow(item: SessionSetupDialogItem) {
    return (
      <div
        key={item.id}
        className="flex items-center justify-between gap-3 rounded-lg border p-3"
      >
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="min-w-0 truncate text-sm font-medium">{item.label}</p>
            <Badge variant="secondary" className="h-5">
              {formatSetupInputKindLabel(item.inputKind)}
            </Badge>
            {item.isFixed ? (
              <Badge variant="outline" className="h-5">
                Fixed
              </Badge>
            ) : null}
            {item.isRequired ? (
              <Badge variant="outline" className="h-5">
                Required
              </Badge>
            ) : null}
          </div>
        </div>

        {canEditSetupMetricDefinition(item) ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={isMobile ? "h-11 w-11 shrink-0 rounded-xl" : "shrink-0"}
            aria-label={`Edit setup metric ${item.label}`}
            onClick={() => openEditMetricDialog(item)}
          >
            <PencilIcon className="size-4" />
          </Button>
        ) : null}
      </div>
    )
  }

  function renderSection(title: string, children: React.ReactNode, action?: React.ReactNode) {
    return (
      <section className="space-y-3">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {action}
        </div>
        {children}
      </section>
    )
  }

  function renderManageMetricsButton(metricGroup: SetupMetricGroup) {
    const title = getSetupMetricGroupTitle(metricGroup)

    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={
          isMobile
            ? "h-11 w-11 rounded-xl bg-muted hover:bg-muted/80"
            : "size-9 rounded-xl bg-muted hover:bg-muted/80"
        }
        aria-label={`Manage ${title} metrics`}
        onClick={() => {
          setSetupSurfaceView(getSetupSurfaceViewForMetricGroup(metricGroup))
          setEditingMetricId(null)
        }}
      >
        <Settings2Icon className="size-4" />
      </Button>
    )
  }

  function renderSetupMetricsManager(metricGroup: SetupMetricGroup) {
    const title = getSetupMetricGroupTitle(metricGroup)
    const managerItems = metricGroup === "boat" ? orderedBoatItems : groupedItems.weather

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-6 pr-5 scroll-pb-20 md:pb-4 md:scroll-pb-4">
          {managerItems.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              No {title} metrics configured for this team yet.
            </div>
          ) : (
            managerItems.map((item) => renderSetupMetricDefinitionRow(item))
          )}
        </div>
      </div>
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
        <div className="no-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6 pr-5 scroll-pb-28 md:pb-4 md:scroll-pb-4">
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
                          return renderEditableMetricRow(item)
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
                    renderManageMetricsButton("weather"),
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
                          {orderedBoatItems.map((item) => renderEditableMetricRow(item))}
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
                    renderManageMetricsButton("boat"),
                  )
                : null}
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

  const metricEditFooterContent = editingMetric ? (
    <div
      className={
        editingMetric.isRequired ? "grid w-full grid-cols-1 gap-2" : "grid w-full grid-cols-4 gap-2"
      }
    >
      {!editingMetric.isRequired ? (
        <Button
          type="button"
          variant="destructive"
          disabled={isMetricPending}
          className={`col-span-1 min-w-0 px-2 ${isMobile ? "h-11" : "h-10"}`}
          aria-label="Delete metric"
          onClick={handleMetricDelete}
        >
          {isDeletingMetric ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <>
              <Trash2Icon className="size-4" />
              <span className="hidden sm:inline">Delete</span>
            </>
          )}
        </Button>
      ) : null}
      <EditSetupMetricSubmitButton
        className={`${editingMetric.isRequired ? "col-span-1" : "col-span-3"} ${
          isMobile ? "h-11" : "h-10"
        }`}
        disabled={isMetricPending}
        isSaving={isSavingMetric}
      />
    </div>
  ) : null

  const metricEditForm = editingMetric ? (
    <form onSubmit={handleMetricSubmit} className="flex min-h-0 flex-1 flex-col">
      <SetupScopeHiddenFields sessionId={input.sessionId} scope={input.scope} />
      <input type="hidden" name="itemId" value={editingMetric.id} />
      <input type="hidden" name="metricGroup" value={editingMetric.metricGroup} />
      <input type="hidden" name="optionsPayload" value={updateMetricOptionsPayload} />
      {editingMetric.isRequired ? (
        <input type="hidden" name="inputKind" value={editingMetricKind} />
      ) : null}

      <EditSetupMetricFieldset isPending={isMetricPending}>
        <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6 pr-5 scroll-pb-28 md:pb-4 md:scroll-pb-4">
          <div className="space-y-2">
            <Label htmlFor="edit-setup-metric-label">Metric name</Label>
            <Input
              id="edit-setup-metric-label"
              name="label"
              value={editingMetricLabel}
              onChange={(event) => setEditingMetricLabel(event.target.value)}
              onFocus={keepMobileFieldVisible}
              className={isMobile ? "h-11 px-3" : undefined}
              maxLength={120}
              readOnly={editingMetric.isRequired}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-setup-metric-kind">Input kind</Label>
            <select
              id="edit-setup-metric-kind"
              name="inputKind"
              value={editingMetricKind}
              disabled={editingMetric.isRequired}
              onChange={(event) =>
                setEditingMetricKind(
                  event.target.value as "single_select" | "multi_select" | "text",
                )
              }
              onFocus={keepMobileFieldVisible}
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
                onFocus={keepMobileFieldVisible}
                className="max-h-56 min-h-24 overflow-y-auto [field-sizing:fixed]"
                rows={6}
                placeholder={"Option A\nOption B\nOption C"}
              />
            </div>
          ) : null}
        </div>
      </EditSetupMetricFieldset>

      {isMobile ? (
        <DrawerFooter className="shrink-0 border-t">{metricEditFooterContent}</DrawerFooter>
      ) : (
        <SheetFooter className="shrink-0 border-t sm:justify-start">
          {metricEditFooterContent}
        </SheetFooter>
      )}
    </form>
  ) : null

  const activeMetricGroup = getSetupMetricGroupForSurfaceView(setupSurfaceView)
  const activeMetricGroupTitle = activeMetricGroup
    ? getSetupMetricGroupTitle(activeMetricGroup)
    : null
  const setupSurfaceContent = editingMetric
    ? metricEditForm
    : activeMetricGroup
      ? renderSetupMetricsManager(activeMetricGroup)
      : setupForm
  const setupSurfaceTitle = editingMetric
    ? "Edit Setup Metric"
    : activeMetricGroupTitle
      ? `${activeMetricGroupTitle} Metrics`
      : "Session Setup"
  const setupSurfaceDescription = editingMetric
    ? "Update the selected setup metric."
    : activeMetricGroupTitle
      ? `Manage ${activeMetricGroupTitle} metric definitions.`
      : "Review and update session setup metrics."
  const canNavigateBack = Boolean(editingMetric) || activeMetricGroup !== null
  const handleSurfaceBack = () => {
    if (editingMetric) {
      closeMetricEditor()
      return
    }

    setSetupSurfaceView("setup")
  }
  const setupDrawerHeaderContent = (
    <div className="relative flex min-h-11 items-center justify-center px-12">
      {canNavigateBack ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute left-0 top-0 h-11 w-11 rounded-xl active:not-aria-[haspopup]:translate-y-0"
          onClick={handleSurfaceBack}
        >
          <ArrowLeftIcon className="size-4" />
          <span className="sr-only">Back</span>
        </Button>
      ) : null}
      <DrawerTitle className="truncate text-center">{setupSurfaceTitle}</DrawerTitle>
      <DrawerDescription className="sr-only">{setupSurfaceDescription}</DrawerDescription>
    </div>
  )
  const setupSheetHeaderContent = (
    <div className="flex min-w-0 items-center gap-2">
      {canNavigateBack ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-9 shrink-0 rounded-xl"
          onClick={handleSurfaceBack}
        >
          <ArrowLeftIcon className="size-4" />
          <span className="sr-only">Back</span>
        </Button>
      ) : null}
      <div className="min-w-0 text-left">
        <SheetTitle>{setupSurfaceTitle}</SheetTitle>
      </div>
    </div>
  )

  const setupSurface = isMobile ? (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="default"
        size="icon"
        className="mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
        aria-label="Open session setup"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => handleOpenChange(true)}
      >
        <Settings2Icon className="size-6" />
      </Button>
      <DrawerContent className="h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
        {canNavigateBack ? (
          <DrawerHeader className="shrink-0 px-4 py-2">
            {setupDrawerHeaderContent}
          </DrawerHeader>
        ) : (
          <DrawerHeader className="sr-only">
            <DrawerTitle>{setupSurfaceTitle}</DrawerTitle>
            <DrawerDescription>{setupSurfaceDescription}</DrawerDescription>
          </DrawerHeader>
        )}
        {setupSurfaceContent}
      </DrawerContent>
    </Drawer>
  ) : (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={<Button type="button" variant="outline" size="sm" className="hidden md:inline-flex" />}
      >
        Setup
      </SheetTrigger>
      <SheetContent side="right" className="h-full overflow-hidden sm:max-w-5xl">
        <SheetHeader className="shrink-0 border-b pr-14">
          {setupSheetHeaderContent}
        </SheetHeader>
        {setupSurfaceContent}
      </SheetContent>
    </Sheet>
  )

  return <>{setupSurface}</>
}

export type SetupDialogProps = Parameters<typeof SetupDialog>[0]
