"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, PlusIcon, SearchIcon, SpellCheckIcon } from "lucide-react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  createSessionStandardMoveAction,
  createSessionWindPatternAction,
  saveSessionInfoAction,
  updateSessionInfoAction,
} from "@/features/sessions/actions"
import type {
  SessionDetailCatalogPage,
  SessionDetailStandardMove,
  SessionDetailStandardMovesCatalogData,
  SessionDetailWindPattern,
  SessionDetailWindPatternsCatalogData,
} from "@/features/sessions/detail-types"
import { generateStandardMoveNameFromDescription } from "@/lib/standard-moves"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import type { NavigationScope } from "@/lib/navigation/types"

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

type InfoEditSection = "coaching" | "standardMoves" | "windPatterns"

export type SessionInfoState = {
  bestOfSession: string | null
  toWork: string | null
  standardMoves: string[]
  windPatterns: string[]
  legacyWindPatterns: string | null
  freeNotes: string | null
}

export type SessionInfoStandardMove = SessionDetailStandardMove

export type SessionInfoWindPattern = SessionDetailWindPattern

type SessionInfoCatalogLoadMode = "append" | "replace"

type SessionInfoCatalogErrorPayload = {
  detail?: unknown
  error?: unknown
}

type StandardMovesCatalogResponse = {
  catalog: "standardMoves"
  data: SessionDetailStandardMovesCatalogData
}

type WindPatternsCatalogResponse = {
  catalog: "windPatterns"
  data: SessionDetailWindPatternsCatalogData
}

function mergeCatalogOptionsById<T extends { id: string; name: string }>(
  currentOptions: T[],
  nextOptions: T[],
): T[] {
  const optionsById = new Map<string, T>()

  for (const option of [...currentOptions, ...nextOptions]) {
    optionsById.set(option.id, option)
  }

  return [...optionsById.values()].sort((left, right) => left.name.localeCompare(right.name))
}

function resolveCachedOptionsByIds<T extends { id: string }>(
  options: T[],
  ids: string[],
): T[] {
  const optionById = new Map(options.map((option) => [option.id, option]))

  return ids
    .map((id) => optionById.get(id) ?? null)
    .filter((option): option is T => option !== null)
}

function buildSessionInfoCatalogUrl(input: {
  catalog: "standardMoves" | "windPatterns"
  linkedIds: string[]
  scope: NavigationScope
  search: string
  sessionId: string
  offset: number
}): string {
  const params = new URLSearchParams()
  params.set("catalog", input.catalog)
  params.set("offset", String(input.offset))
  params.set("search", input.search)
  params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.scope.activeOrgId)

  if (input.scope.activeTeamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.scope.activeTeamId)
  }

  const linkedParam =
    input.catalog === "standardMoves" ? "linkedStandardMoveId" : "linkedWindPatternId"

  for (const linkedId of input.linkedIds) {
    params.append(linkedParam, linkedId)
  }

  return `/api/team-sessions/${encodeURIComponent(input.sessionId)}/catalog?${params.toString()}`
}

async function resolveSessionInfoCatalogErrorMessage(response: Response): Promise<string> {
  let payload: SessionInfoCatalogErrorPayload | null = null

  try {
    payload = (await response.json()) as SessionInfoCatalogErrorPayload
  } catch {
    payload = null
  }

  const errorCode = typeof payload?.error === "string" ? payload.error : null

  if (response.status === 401 || errorCode === "unauthorized") {
    return "Your session expired. Sign in again, then retry search."
  }

  if (response.status === 403 || errorCode === "scope_required") {
    return "This search needs an active team scope."
  }

  if (response.status === 404 || errorCode === "session_not_found") {
    return "This session is unavailable in the active team scope."
  }

  return "Could not load more catalog items."
}

async function fetchStandardMovesCatalog(input: {
  linkedStandardMoveIds: string[]
  scope: NavigationScope
  search: string
  sessionId: string
  offset: number
}): Promise<SessionDetailStandardMovesCatalogData> {
  const response = await fetch(
    buildSessionInfoCatalogUrl({
      catalog: "standardMoves",
      linkedIds: input.linkedStandardMoveIds,
      scope: input.scope,
      search: input.search,
      sessionId: input.sessionId,
      offset: input.offset,
    }),
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  )

  if (!response.ok) {
    throw new Error(await resolveSessionInfoCatalogErrorMessage(response))
  }

  const payload = (await response.json()) as StandardMovesCatalogResponse
  return payload.data
}

async function fetchWindPatternsCatalog(input: {
  linkedWindPatternIds: string[]
  scope: NavigationScope
  search: string
  sessionId: string
  offset: number
}): Promise<SessionDetailWindPatternsCatalogData> {
  const response = await fetch(
    buildSessionInfoCatalogUrl({
      catalog: "windPatterns",
      linkedIds: input.linkedWindPatternIds,
      scope: input.scope,
      search: input.search,
      sessionId: input.sessionId,
      offset: input.offset,
    }),
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  )

  if (!response.ok) {
    throw new Error(await resolveSessionInfoCatalogErrorMessage(response))
  }

  const payload = (await response.json()) as WindPatternsCatalogResponse
  return payload.data
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
      <TooltipContent side="top" className="text-left leading-relaxed sm:max-w-sm">
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

function resolveLinkedWindPatternBadges(input: {
  availableWindPatterns: SessionInfoWindPattern[]
  linkedWindPatternIds: string[]
  fallbackWindPatternNames: string[]
}): SessionInfoWindPattern[] {
  const windPatternById = new Map(
    input.availableWindPatterns.map((windPattern) => [windPattern.id, windPattern]),
  )
  const linkedWindPatterns = input.linkedWindPatternIds
    .map((windPatternId) => windPatternById.get(windPatternId) ?? null)
    .filter((windPattern): windPattern is SessionInfoWindPattern => windPattern !== null)

  if (linkedWindPatterns.length > 0) {
    return linkedWindPatterns.sort((left, right) => left.name.localeCompare(right.name))
  }

  return input.fallbackWindPatternNames.map((name, index) => ({
    id: `fallback-${index}-${name}`,
    name,
    description: null,
    isActive: true,
  }))
}

function WindPatternTooltipBadge(props: {
  windPattern: SessionInfoWindPattern
  isMobile: boolean
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const description = props.windPattern.description?.trim()
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
          <span className="max-w-[16rem] truncate">{props.windPattern.name}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-left leading-relaxed sm:max-w-sm">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function SessionInfoWindPatternBadges(input: {
  availableWindPatterns: SessionInfoWindPattern[]
  linkedWindPatternIds: string[]
  fallbackWindPatternNames: string[]
  legacyWindPatterns: string | null
}) {
  const isMobile = useIsMobile()
  const windPatterns = resolveLinkedWindPatternBadges(input)

  if (windPatterns.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-sm">
        {renderTextValue(input.legacyWindPatterns)}
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {windPatterns.map((windPattern) => (
        <WindPatternTooltipBadge
          key={windPattern.id}
          windPattern={windPattern}
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
  standardMoveIds: string[]
  windPatternIds: string[]
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

function buildOptimisticWindPatternNames(input: {
  availableWindPatterns: SessionInfoWindPattern[]
  selectedWindPatternIds: string[]
}): string[] {
  const windPatternById = new Map(
    input.availableWindPatterns.map((windPattern) => [windPattern.id, windPattern]),
  )
  const names = input.selectedWindPatternIds
    .map((windPatternId) => windPatternById.get(windPatternId)?.name ?? null)
    .filter((windPatternName): windPatternName is string => windPatternName !== null)

  return [...new Set(names)].sort((left, right) => left.localeCompare(right))
}

function buildOptimisticInfoState(input: {
  draft: SessionInfoSaveDraft
  availableStandardMoves: SessionInfoStandardMove[]
  availableWindPatterns: SessionInfoWindPattern[]
  legacyWindPatterns: string | null
}): SessionInfoState {
  return {
    bestOfSession: normalizeInfoText(input.draft.bestOfSession),
    toWork: normalizeInfoText(input.draft.toWork),
    freeNotes: normalizeInfoText(input.draft.freeNotes),
    standardMoves: buildOptimisticStandardMoveNames({
      availableStandardMoves: input.availableStandardMoves,
      selectedStandardMoveIds: input.draft.standardMoveIds,
    }),
    windPatterns: buildOptimisticWindPatternNames({
      availableWindPatterns: input.availableWindPatterns,
      selectedWindPatternIds: input.draft.windPatternIds,
    }),
    legacyWindPatterns: input.legacyWindPatterns,
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

  for (const standardMoveId of input.draft.standardMoveIds) {
    input.formData.append("standardMoveId", standardMoveId)
  }

  for (const windPatternId of input.draft.windPatternIds) {
    input.formData.append("windPatternId", windPatternId)
  }
}

function resolveInfoEditCopy(section: InfoEditSection): {
  triggerLabel: string
  title: string
  description?: string
  submitLabel: string
} {
  if (section === "coaching") {
    return {
      triggerLabel: "Edit",
      title: "Edit Coaching Notes",
      submitLabel: "Save",
    }
  }

  if (section === "standardMoves") {
    return {
      triggerLabel: "Edit",
      title: "Edit Standard Moves",
      submitLabel: "Save",
    }
  }

  return {
    triggerLabel: "Edit",
    title: "Edit Wind Patterns",
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
  standardMoveCatalogPage: SessionDetailCatalogPage
  linkedStandardMoveIds: string[]
  availableWindPatterns: {
    id: string
    name: string
    description: string | null
    isActive: boolean
  }[]
  windPatternCatalogPage: SessionDetailCatalogPage
  linkedWindPatternIds: string[]
  windPatterns: string[]
  legacyWindPatterns: string | null
  freeNotes: string | null
  onStandardMoveCreate: (input: {
    standardMove: SessionInfoStandardMove
    availableStandardMoves: SessionInfoStandardMove[]
  }) => void
  onWindPatternCreate: (input: {
    windPattern: SessionInfoWindPattern
    availableWindPatterns: SessionInfoWindPattern[]
  }) => void
  onStandardMoveCatalogLoad: (input: {
    availableStandardMoves: SessionInfoStandardMove[]
    mode: SessionInfoCatalogLoadMode
    page: SessionDetailCatalogPage
  }) => void
  onWindPatternCatalogLoad: (input: {
    availableWindPatterns: SessionInfoWindPattern[]
    mode: SessionInfoCatalogLoadMode
    page: SessionDetailCatalogPage
  }) => void
  onSave: (draft: SessionInfoSaveDraft) => Promise<boolean>
}) {
  const [bestOfSession, setBestOfSession] = React.useState(input.bestOfSession ?? "")
  const [toWork, setToWork] = React.useState(input.toWork ?? "")
  const [standardMoveIds, setStandardMoveIds] = React.useState<string[]>(input.linkedStandardMoveIds)
  const [windPatternIds, setWindPatternIds] = React.useState<string[]>(input.linkedWindPatternIds)
  const [newStandardMoveName, setNewStandardMoveName] = React.useState("")
  const [newStandardMoveDescription, setNewStandardMoveDescription] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isQuickCreateDialogOpen, setIsQuickCreateDialogOpen] = React.useState(false)
  const [isCreatingStandardMove, setIsCreatingStandardMove] = React.useState(false)
  const [isQuickCreateNameManuallyEdited, setIsQuickCreateNameManuallyEdited] =
    React.useState(false)
  const [freeNotes, setFreeNotes] = React.useState(input.freeNotes ?? "")
  const [standardMoveSearch, setStandardMoveSearch] = React.useState("")
  const [windPatternSearch, setWindPatternSearch] = React.useState("")
  const [standardMoveCatalogOptions, setStandardMoveCatalogOptions] = React.useState<
    SessionInfoStandardMove[]
  >(input.availableStandardMoves)
  const [standardMoveCatalogPage, setStandardMoveCatalogPage] =
    React.useState<SessionDetailCatalogPage>(input.standardMoveCatalogPage)
  const [windPatternCatalogOptions, setWindPatternCatalogOptions] = React.useState<
    SessionInfoWindPattern[]
  >(input.availableWindPatterns)
  const [windPatternCatalogPage, setWindPatternCatalogPage] =
    React.useState<SessionDetailCatalogPage>(input.windPatternCatalogPage)
  const [isStandardMoveCatalogLoading, setIsStandardMoveCatalogLoading] =
    React.useState(false)
  const [isWindPatternCatalogLoading, setIsWindPatternCatalogLoading] = React.useState(false)
  const [standardMoveCatalogError, setStandardMoveCatalogError] = React.useState<string | null>(
    null,
  )
  const [windPatternCatalogError, setWindPatternCatalogError] = React.useState<string | null>(
    null,
  )
  const standardMoveCatalogRequestVersionRef = React.useRef(0)
  const windPatternCatalogRequestVersionRef = React.useRef(0)
  const isMobile = useIsMobile()
  const hasQuickCreateDescription = newStandardMoveDescription.trim().length > 0
  const standardMoveOptions = mergeCatalogOptionsById(
    standardMoveCatalogOptions,
    input.availableStandardMoves.filter((standardMove) =>
      standardMoveIds.includes(standardMove.id),
    ),
  ).filter(
    (standardMove) =>
      standardMove.isActive ||
      input.linkedStandardMoveIds.includes(standardMove.id) ||
      standardMoveIds.includes(standardMove.id),
  )
  const windPatternOptions = mergeCatalogOptionsById(
    windPatternCatalogOptions,
    input.availableWindPatterns.filter((windPattern) =>
      windPatternIds.includes(windPattern.id),
    ),
  ).filter(
    (windPattern) =>
      windPattern.isActive ||
      input.linkedWindPatternIds.includes(windPattern.id) ||
      windPatternIds.includes(windPattern.id),
  )
  const copy = resolveInfoEditCopy(input.section)
  const canCreateStandardMove =
    hasQuickCreateDescription && !isCreatingStandardMove && Boolean(input.scope.activeTeamId)
  const canCreateWindPattern =
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

    setStandardMoveIds(input.linkedStandardMoveIds)
  }, [input.linkedStandardMoveIds, isOpen, isSaving])

  React.useEffect(() => {
    if (isOpen || isSaving) {
      return
    }

    setWindPatternIds(input.linkedWindPatternIds)
  }, [input.linkedWindPatternIds, isOpen, isSaving])

  React.useEffect(() => {
    if (isOpen || isSaving) {
      return
    }

    setStandardMoveCatalogOptions(input.availableStandardMoves)
    setStandardMoveCatalogPage(input.standardMoveCatalogPage)
    setStandardMoveCatalogError(null)
  }, [input.availableStandardMoves, input.standardMoveCatalogPage, isOpen, isSaving])

  React.useEffect(() => {
    if (isOpen || isSaving) {
      return
    }

    setWindPatternCatalogOptions(input.availableWindPatterns)
    setWindPatternCatalogPage(input.windPatternCatalogPage)
    setWindPatternCatalogError(null)
  }, [input.availableWindPatterns, input.windPatternCatalogPage, isOpen, isSaving])

  const loadStandardMoveCatalog = React.useCallback(
    async (request: {
      mode: SessionInfoCatalogLoadMode
      offset: number
      search: string
    }) => {
      const requestVersion = standardMoveCatalogRequestVersionRef.current + 1
      standardMoveCatalogRequestVersionRef.current = requestVersion
      setIsStandardMoveCatalogLoading(true)
      setStandardMoveCatalogError(null)

      try {
        const result = await fetchStandardMovesCatalog({
          linkedStandardMoveIds: standardMoveIds,
          scope: input.scope,
          search: request.search,
          sessionId: input.sessionId,
          offset: request.offset,
        })

        if (requestVersion !== standardMoveCatalogRequestVersionRef.current) {
          return
        }

        setStandardMoveCatalogOptions((currentOptions) =>
          request.mode === "append"
            ? mergeCatalogOptionsById(currentOptions, result.availableStandardMoves)
            : result.availableStandardMoves,
        )
        setStandardMoveCatalogPage(result.standardMoveCatalogPage)
        input.onStandardMoveCatalogLoad({
          availableStandardMoves: result.availableStandardMoves,
          mode: request.mode,
          page: result.standardMoveCatalogPage,
        })
      } catch (error) {
        if (requestVersion !== standardMoveCatalogRequestVersionRef.current) {
          return
        }

        setStandardMoveCatalogError(
          error instanceof Error ? error.message : "Could not load standard moves.",
        )
      } finally {
        if (requestVersion === standardMoveCatalogRequestVersionRef.current) {
          setIsStandardMoveCatalogLoading(false)
        }
      }
    },
    [input, standardMoveIds],
  )

  const loadWindPatternCatalog = React.useCallback(
    async (request: {
      mode: SessionInfoCatalogLoadMode
      offset: number
      search: string
    }) => {
      const requestVersion = windPatternCatalogRequestVersionRef.current + 1
      windPatternCatalogRequestVersionRef.current = requestVersion
      setIsWindPatternCatalogLoading(true)
      setWindPatternCatalogError(null)

      try {
        const result = await fetchWindPatternsCatalog({
          linkedWindPatternIds: windPatternIds,
          scope: input.scope,
          search: request.search,
          sessionId: input.sessionId,
          offset: request.offset,
        })

        if (requestVersion !== windPatternCatalogRequestVersionRef.current) {
          return
        }

        setWindPatternCatalogOptions((currentOptions) =>
          request.mode === "append"
            ? mergeCatalogOptionsById(currentOptions, result.availableWindPatterns)
            : result.availableWindPatterns,
        )
        setWindPatternCatalogPage(result.windPatternCatalogPage)
        input.onWindPatternCatalogLoad({
          availableWindPatterns: result.availableWindPatterns,
          mode: request.mode,
          page: result.windPatternCatalogPage,
        })
      } catch (error) {
        if (requestVersion !== windPatternCatalogRequestVersionRef.current) {
          return
        }

        setWindPatternCatalogError(
          error instanceof Error ? error.message : "Could not load wind patterns.",
        )
      } finally {
        if (requestVersion === windPatternCatalogRequestVersionRef.current) {
          setIsWindPatternCatalogLoading(false)
        }
      }
    },
    [input, windPatternIds],
  )

  React.useEffect(() => {
    if (!isOpen || input.section !== "standardMoves") {
      return
    }

    const normalizedSearch = standardMoveSearch.trim()

    if (
      normalizedSearch === standardMoveCatalogPage.search &&
      standardMoveCatalogPage.offset === 0
    ) {
      return
    }

    const searchTimer = window.setTimeout(() => {
      void loadStandardMoveCatalog({
        mode: "replace",
        offset: 0,
        search: normalizedSearch,
      })
    }, 250)

    return () => window.clearTimeout(searchTimer)
  }, [
    input.section,
    isOpen,
    loadStandardMoveCatalog,
    standardMoveCatalogPage.offset,
    standardMoveCatalogPage.search,
    standardMoveSearch,
  ])

  React.useEffect(() => {
    if (!isOpen || input.section !== "windPatterns") {
      return
    }

    const normalizedSearch = windPatternSearch.trim()

    if (
      normalizedSearch === windPatternCatalogPage.search &&
      windPatternCatalogPage.offset === 0
    ) {
      return
    }

    const searchTimer = window.setTimeout(() => {
      void loadWindPatternCatalog({
        mode: "replace",
        offset: 0,
        search: normalizedSearch,
      })
    }, 250)

    return () => window.clearTimeout(searchTimer)
  }, [
    input.section,
    isOpen,
    loadWindPatternCatalog,
    windPatternCatalogPage.offset,
    windPatternCatalogPage.search,
    windPatternSearch,
  ])

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
    const isWindPatternCreate = input.section === "windPatterns"
    const canCreateQuickItem = isWindPatternCreate ? canCreateWindPattern : canCreateStandardMove

    if (!canCreateQuickItem || !input.scope.activeTeamId) {
      return
    }

    const normalizedDescription = newStandardMoveDescription.trim()
    const fallbackPrefix = isWindPatternCreate ? "Wind Pattern" : "Standard Move"
    const resolvedName =
      newStandardMoveName.trim().length > 0
        ? newStandardMoveName.trim()
        : generateStandardMoveNameFromDescription(normalizedDescription, fallbackPrefix)
    const formData = new FormData()

    formData.set("sessionId", input.sessionId)
    formData.set("scopeOrgId", input.scope.activeOrgId)
    formData.set("scopeTeamId", input.scope.activeTeamId)
    formData.set("name", resolvedName)
    formData.set("description", normalizedDescription)

    setIsCreatingStandardMove(true)
    const toastId = toast.loading(
      isWindPatternCreate ? "Creating wind pattern..." : "Creating standard move...",
    )

    try {
      if (isWindPatternCreate) {
        const result = await createSessionWindPatternAction(formData)

        if (!result.ok) {
          toast.error(result.message, { id: toastId })
          return
        }

        input.onWindPatternCreate({
          windPattern: result.windPattern,
          availableWindPatterns: result.availableWindPatterns,
        })
        setWindPatternCatalogOptions((currentOptions) =>
          mergeCatalogOptionsById(currentOptions, [result.windPattern]),
        )
        setWindPatternIds((currentWindPatternIds) =>
          currentWindPatternIds.includes(result.windPattern.id)
            ? currentWindPatternIds
            : [...currentWindPatternIds, result.windPattern.id],
        )
        setWindPatternSearch("")
        resetQuickCreateState()
        setIsQuickCreateDialogOpen(false)
        toast.success("Wind pattern created and selected.", { id: toastId })
        return
      }

      const result = await createSessionStandardMoveAction(formData)

      if (!result.ok) {
        toast.error(result.message, { id: toastId })
        return
      }

      input.onStandardMoveCreate({
        standardMove: result.standardMove,
        availableStandardMoves: result.availableStandardMoves,
      })
      setStandardMoveCatalogOptions((currentOptions) =>
        mergeCatalogOptionsById(currentOptions, [result.standardMove]),
      )
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
      toast.error(
        isWindPatternCreate
          ? "Could not create wind pattern. Confirm permissions and try again."
          : "Could not create standard move. Confirm permissions and try again.",
        { id: toastId },
      )
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
      standardMoveIds,
      windPatternIds,
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
      setWindPatternSearch("")
      resetQuickCreateState()
    }
  }

  const isCatalogSection = input.section === "standardMoves" || input.section === "windPatterns"
  const quickCreateItemLabel = input.section === "windPatterns" ? "Wind Pattern" : "Standard Move"
  const quickCreateDialogTitle =
    input.section === "windPatterns" ? "Quick Create Wind Pattern" : "Quick Create Std. Move"
  const quickCreateDescriptionPlaceholder =
    input.section === "windPatterns"
      ? "Describe the pattern in plain language."
      : "Describe the move in plain language."
  const canCreateQuickItem =
    input.section === "windPatterns" ? canCreateWindPattern : canCreateStandardMove
  const quickCreateDescriptionId = `quick-${input.section}-description-${input.sessionId}`
  const quickCreateNameId = `quick-${input.section}-name-${input.sessionId}`
  const quickCreatePanel =
    isCatalogSection ? (
      <div className="shrink-0 border-t bg-popover px-4 py-3">
        <div className="grid gap-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-h-9 items-center">
              <p className="text-sm font-medium">New {quickCreateItemLabel}</p>
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
                  <DialogTitle>{quickCreateDialogTitle}</DialogTitle>
                  <DialogDescription>
                    Description is required. Name is auto-generated and editable.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <fieldset disabled={isCreatingStandardMove} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={quickCreateDescriptionId}>Description</Label>
                      <Textarea
                        id={quickCreateDescriptionId}
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
                                generateStandardMoveNameFromDescription(
                                  nextDescription,
                                  quickCreateItemLabel,
                                ),
                              )
                            }
                          }
                        }}
                        placeholder={quickCreateDescriptionPlaceholder}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={quickCreateNameId}>Name</Label>
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
                              generateStandardMoveNameFromDescription(
                                newStandardMoveDescription,
                                quickCreateItemLabel,
                              ),
                            )
                            setIsQuickCreateNameManuallyEdited(false)
                          }}
                        >
                          Use generated
                        </Button>
                      </div>
                      <Input
                        id={quickCreateNameId}
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
                      disabled={!canCreateQuickItem}
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
      {input.section !== "windPatterns"
        ? windPatternIds.map((windPatternId) => (
            <input
              key={windPatternId}
              type="hidden"
              name="windPatternId"
              value={windPatternId}
            />
          ))
        : null}

      <InfoDialogFieldset
        className={isCatalogSection ? "flex flex-col gap-4" : undefined}
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
                {isStandardMoveCatalogLoading && standardMoveOptions.length === 0 ? (
                  <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" />
                    Loading standard moves...
                  </p>
                ) : standardMoveOptions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {standardMoveSearch.trim().length > 0
                      ? "No standard moves match this search."
                      : "No standard moves available yet."}
                  </p>
                ) : standardMoveCatalogError ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    {standardMoveCatalogError}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Accordion className="gap-1">
                      {standardMoveOptions.map((standardMove) => {
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

                    {standardMoveCatalogPage.nextOffset !== null ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isStandardMoveCatalogLoading}
                        onClick={() =>
                          void loadStandardMoveCatalog({
                            mode: "append",
                            offset: standardMoveCatalogPage.nextOffset ?? 0,
                            search: standardMoveSearch.trim(),
                          })
                        }
                      >
                        {isStandardMoveCatalogLoading ? (
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
              </div>
            </div>
          </>
        ) : null}

        {input.section === "windPatterns" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="relative shrink-0">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={windPatternSearch}
                onChange={(event) => setWindPatternSearch(event.target.value)}
                placeholder="Search Wind Patterns"
                className="pl-9"
                aria-label="Search Wind Patterns"
              />
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto p-1"
              role="group"
              aria-label="Wind Patterns"
            >
              {isWindPatternCatalogLoading && windPatternOptions.length === 0 ? (
                <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  Loading wind patterns...
                </p>
              ) : windPatternOptions.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {windPatternSearch.trim().length > 0
                    ? "No wind patterns match this search."
                    : "No wind patterns available yet."}
                </p>
              ) : windPatternCatalogError ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {windPatternCatalogError}
                </p>
              ) : (
                <div className="space-y-2">
                  <Accordion className="gap-1">
                    {windPatternOptions.map((windPattern) => {
                      const isSelected = windPatternIds.includes(windPattern.id)
                      const hasDescription =
                        windPattern.description !== null &&
                        windPattern.description.trim().length > 0

                      return (
                        <AccordionItem
                          key={windPattern.id}
                          value={windPattern.id}
                          className="rounded-md border-0"
                        >
                          <div className="flex min-h-12 items-center gap-3 rounded-md px-2 py-2 text-xs transition-colors hover:bg-muted/60">
                            <Checkbox
                              name="windPatternId"
                              value={windPattern.id}
                              checked={isSelected}
                              disabled={!windPattern.isActive && !isSelected}
                              onCheckedChange={(checked) => {
                                setWindPatternIds((currentWindPatternIds) => {
                                  if (checked) {
                                    return currentWindPatternIds.includes(windPattern.id)
                                      ? currentWindPatternIds
                                      : [...currentWindPatternIds, windPattern.id]
                                  }

                                  return currentWindPatternIds.filter(
                                    (windPatternId) => windPatternId !== windPattern.id,
                                  )
                                })
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <AccordionTrigger
                                className="w-full py-0 text-sm hover:no-underline [&_[data-slot=accordion-trigger-icon]]:size-4"
                                disabled={!hasDescription && windPattern.isActive}
                              >
                                <span className="truncate">{windPattern.name}</span>
                              </AccordionTrigger>
                            </div>
                          </div>
                          <AccordionContent className="pl-11 pr-2 pb-3 text-sm text-muted-foreground">
                            {hasDescription ? (
                              <p className="whitespace-pre-wrap">{windPattern.description}</p>
                            ) : null}
                            {!windPattern.isActive ? (
                              <p className={hasDescription ? "mt-2" : undefined}>Archived</p>
                            ) : null}
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>

                  {windPatternCatalogPage.nextOffset !== null ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isWindPatternCatalogLoading}
                      onClick={() =>
                        void loadWindPatternCatalog({
                          mode: "append",
                          offset: windPatternCatalogPage.nextOffset ?? 0,
                          search: windPatternSearch.trim(),
                        })
                      }
                    >
                      {isWindPatternCatalogLoading ? (
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
            </div>
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
            {copy.description ? (
              <DrawerDescription>{copy.description}</DrawerDescription>
            ) : null}
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
          {copy.description ? <SheetDescription>{copy.description}</SheetDescription> : null}
        </SheetHeader>

        {infoForm}
      </SheetContent>
    </Sheet>
  )
}

export type SessionInfoPanelProps = {
  sessionId: string
  scope: NavigationScope
  info: SessionInfoState
  availableStandardMoves: SessionInfoStandardMove[]
  linkedStandardMoveIds: string[]
  standardMoveCatalogPage: SessionDetailCatalogPage
  availableWindPatterns: SessionInfoWindPattern[]
  linkedWindPatternIds: string[]
  windPatternCatalogPage: SessionDetailCatalogPage
  canManageSession: boolean
}

export function SessionInfoPanel(input: SessionInfoPanelProps) {
  const router = useRouter()
  const [info, setInfo] = React.useState<SessionInfoState>(input.info)
  const [availableStandardMoves, setAvailableStandardMoves] = React.useState<
    SessionInfoStandardMove[]
  >(input.availableStandardMoves)
  const [linkedStandardMoveIds, setLinkedStandardMoveIds] = React.useState<string[]>(
    input.linkedStandardMoveIds,
  )
  const [standardMoveCatalogPage, setStandardMoveCatalogPage] =
    React.useState<SessionDetailCatalogPage>(input.standardMoveCatalogPage)
  const [availableWindPatterns, setAvailableWindPatterns] = React.useState<
    SessionInfoWindPattern[]
  >(input.availableWindPatterns)
  const [linkedWindPatternIds, setLinkedWindPatternIds] = React.useState<string[]>(
    input.linkedWindPatternIds,
  )
  const [windPatternCatalogPage, setWindPatternCatalogPage] =
    React.useState<SessionDetailCatalogPage>(input.windPatternCatalogPage)

  React.useEffect(() => {
    setInfo(input.info)
  }, [input.info])

  React.useEffect(() => {
    setAvailableStandardMoves(input.availableStandardMoves)
  }, [input.availableStandardMoves])

  React.useEffect(() => {
    setStandardMoveCatalogPage(input.standardMoveCatalogPage)
  }, [input.standardMoveCatalogPage])

  React.useEffect(() => {
    setLinkedStandardMoveIds(input.linkedStandardMoveIds)
  }, [input.linkedStandardMoveIds])

  React.useEffect(() => {
    setAvailableWindPatterns(input.availableWindPatterns)
  }, [input.availableWindPatterns])

  React.useEffect(() => {
    setWindPatternCatalogPage(input.windPatternCatalogPage)
  }, [input.windPatternCatalogPage])

  React.useEffect(() => {
    setLinkedWindPatternIds(input.linkedWindPatternIds)
  }, [input.linkedWindPatternIds])

  const handleInfoSave = React.useCallback(
    async (draft: SessionInfoSaveDraft): Promise<boolean> => {
      const previousInfo = info
      const optimisticInfo = buildOptimisticInfoState({
        draft,
        availableStandardMoves,
        availableWindPatterns,
        legacyWindPatterns: info.legacyWindPatterns,
      })
      const toastId = "session-info-save:" + input.sessionId
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
        setStandardMoveCatalogPage(result.standardMoveCatalogPage)
        setAvailableWindPatterns(result.availableWindPatterns)
        setLinkedWindPatternIds(result.linkedWindPatternIds)
        setWindPatternCatalogPage(result.windPatternCatalogPage)
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
    [availableStandardMoves, availableWindPatterns, info, input.scope, input.sessionId, router],
  )

  const handleStandardMoveCreate = React.useCallback(
    (result: {
      standardMove: SessionInfoStandardMove
      availableStandardMoves: SessionInfoStandardMove[]
    }) => {
      setAvailableStandardMoves((currentMoves) =>
        mergeCatalogOptionsById(currentMoves, [
          ...result.availableStandardMoves,
          result.standardMove,
        ]),
      )
    },
    [],
  )

  const handleStandardMoveCatalogLoad = React.useCallback(
    (result: {
      availableStandardMoves: SessionInfoStandardMove[]
      mode: SessionInfoCatalogLoadMode
      page: SessionDetailCatalogPage
    }) => {
      setAvailableStandardMoves((currentMoves) =>
        result.mode === "append"
          ? mergeCatalogOptionsById(currentMoves, result.availableStandardMoves)
          : mergeCatalogOptionsById(
              result.availableStandardMoves,
              resolveCachedOptionsByIds(currentMoves, linkedStandardMoveIds),
            ),
      )
      setStandardMoveCatalogPage(result.page)
    },
    [linkedStandardMoveIds],
  )

  const handleWindPatternCreate = React.useCallback(
    (result: {
      windPattern: SessionInfoWindPattern
      availableWindPatterns: SessionInfoWindPattern[]
    }) => {
      setAvailableWindPatterns((currentPatterns) =>
        mergeCatalogOptionsById(currentPatterns, [
          ...result.availableWindPatterns,
          result.windPattern,
        ]),
      )
    },
    [],
  )

  const handleWindPatternCatalogLoad = React.useCallback(
    (result: {
      availableWindPatterns: SessionInfoWindPattern[]
      mode: SessionInfoCatalogLoadMode
      page: SessionDetailCatalogPage
    }) => {
      setAvailableWindPatterns((currentPatterns) =>
        result.mode === "append"
          ? mergeCatalogOptionsById(currentPatterns, result.availableWindPatterns)
          : mergeCatalogOptionsById(
              result.availableWindPatterns,
              resolveCachedOptionsByIds(currentPatterns, linkedWindPatternIds),
            ),
      )
      setWindPatternCatalogPage(result.page)
    },
    [linkedWindPatternIds],
  )

  return (
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
              standardMoveCatalogPage={standardMoveCatalogPage}
              linkedStandardMoveIds={linkedStandardMoveIds}
              availableWindPatterns={availableWindPatterns}
              windPatternCatalogPage={windPatternCatalogPage}
              linkedWindPatternIds={linkedWindPatternIds}
              windPatterns={info.windPatterns}
              legacyWindPatterns={info.legacyWindPatterns}
              freeNotes={info.freeNotes}
              onStandardMoveCreate={handleStandardMoveCreate}
              onWindPatternCreate={handleWindPatternCreate}
              onStandardMoveCatalogLoad={handleStandardMoveCatalogLoad}
              onWindPatternCatalogLoad={handleWindPatternCatalogLoad}
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
              standardMoveCatalogPage={standardMoveCatalogPage}
              linkedStandardMoveIds={linkedStandardMoveIds}
              availableWindPatterns={availableWindPatterns}
              windPatternCatalogPage={windPatternCatalogPage}
              linkedWindPatternIds={linkedWindPatternIds}
              windPatterns={info.windPatterns}
              legacyWindPatterns={info.legacyWindPatterns}
              freeNotes={info.freeNotes}
              onStandardMoveCreate={handleStandardMoveCreate}
              onWindPatternCreate={handleWindPatternCreate}
              onStandardMoveCatalogLoad={handleStandardMoveCatalogLoad}
              onWindPatternCatalogLoad={handleWindPatternCatalogLoad}
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
              standardMoveCatalogPage={standardMoveCatalogPage}
              linkedStandardMoveIds={linkedStandardMoveIds}
              availableWindPatterns={availableWindPatterns}
              windPatternCatalogPage={windPatternCatalogPage}
              linkedWindPatternIds={linkedWindPatternIds}
              windPatterns={info.windPatterns}
              legacyWindPatterns={info.legacyWindPatterns}
              freeNotes={info.freeNotes}
              onStandardMoveCreate={handleStandardMoveCreate}
              onWindPatternCreate={handleWindPatternCreate}
              onStandardMoveCatalogLoad={handleStandardMoveCatalogLoad}
              onWindPatternCatalogLoad={handleWindPatternCatalogLoad}
              onSave={handleInfoSave}
            />
          ) : null}
        </div>

        <div className="rounded-lg bg-muted p-4">
          <SessionInfoWindPatternBadges
            availableWindPatterns={availableWindPatterns}
            linkedWindPatternIds={linkedWindPatternIds}
            fallbackWindPatternNames={info.windPatterns}
            legacyWindPatterns={info.legacyWindPatterns}
          />
        </div>
      </section>
    </div>
  )
}
