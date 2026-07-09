"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  Loader2Icon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react"
import { useFormStatus } from "react-dom"

import {
  deleteAssessmentRunAction,
  submitAssessmentAnswersAction,
} from "@/features/assessments/actions"
import type {
  TeamAssessmentDetailData,
  TeamAssessmentMode,
  TeamAssessmentQuestion,
  TeamAssessmentRun,
} from "@/features/assessments/data"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { GradientCard } from "@/components/shared/gradient-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const RESPONDENT_LINE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function getRespondentSeriesColor(index: number): string {
  return RESPONDENT_LINE_COLORS[index % RESPONDENT_LINE_COLORS.length]
}

function getRespondentSeriesColorByDataKey(dataKey: string): string {
  const match = /^respondent(\d+)$/.exec(dataKey)
  const index = match ? Number.parseInt(match[1], 10) - 1 : 0

  return getRespondentSeriesColor(Math.max(index, 0))
}

function normalizeInternalHref(href: string): string {
  const url = new URL(href, "http://sailog.local")
  return `${url.pathname}${url.search}`
}

function AssessmentScopeFields({ scope }: { scope: NavigationScope }) {
  return (
    <>
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
    </>
  )
}

function DeleteRunSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" size="sm" variant="destructive" disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {pending ? "Deleting..." : "Delete"}
    </Button>
  )
}

function AnswerSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {pending ? "Saving answers..." : "Save answers"}
    </Button>
  )
}

function DeleteRunDialog({
  onOpenChange,
  open,
  returnPath,
  run,
  scope,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
  returnPath: string
  run: TeamAssessmentRun
  scope: NavigationScope
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete assessment?</DialogTitle>
          <DialogDescription>
            This will permanently delete <span className="font-medium">{run.name}</span>{" "}
            and all submitted answers linked to it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <form action={deleteAssessmentRunAction}>
            <AssessmentScopeFields scope={scope} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <input type="hidden" name="runId" value={run.id} />
            <input type="hidden" name="teamVenueId" value={run.teamVenueId} />
            <DeleteRunSubmitButton />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssessmentDetailActions({
  canManageAssessments,
  returnPath,
  run,
  scope,
}: {
  canManageAssessments: boolean
  returnPath: string
  run: TeamAssessmentRun
  scope: NavigationScope
}) {
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)

  if (!canManageAssessments) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="outline" size="icon" />}
          aria-label="Open assessment actions"
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setIsDeleteOpen(true)
            }}
          >
            <Trash2Icon className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteRunDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        returnPath={returnPath}
        run={run}
        scope={scope}
      />
    </>
  )
}

function buildInitialSelectionByQuestionId(
  answers: TeamAssessmentRun["myAnswers"],
): Record<string, string> {
  const draft: Record<string, string> = {}

  for (const answer of answers) {
    draft[answer.questionId] = answer.scaleOptionId
  }

  return draft
}

function buildRunAnswerPayloadRows(input: {
  categories: TeamAssessmentRun["categories"]
  selectionByQuestionId: Record<string, string>
}): Array<{ questionId: string; scaleOptionId: string | null }> {
  const rows: Array<{ questionId: string; scaleOptionId: string | null }> = []

  for (const category of input.categories) {
    for (const question of category.questions) {
      rows.push({
        questionId: question.id,
        scaleOptionId: input.selectionByQuestionId[question.id] ?? null,
      })
    }

    for (const mode of category.modes ?? []) {
      for (const question of mode.questions) {
        rows.push({
          questionId: question.id,
          scaleOptionId: input.selectionByQuestionId[question.id] ?? null,
        })
      }
    }
  }

  return rows
}

type TeamAssessmentCategory = TeamAssessmentRun["categories"][number]
type TeamAssessmentAnalyticsItem = TeamAssessmentDetailData["analytics"]["items"][number]
type TeamAssessmentCrewAnswer = TeamAssessmentAnalyticsItem["crewAnswers"][number]
type TeamAssessmentAnalyticsRespondent =
  TeamAssessmentDetailData["analytics"]["respondentSummaries"][number]
type TeamAssessmentChartDatum = Record<string, string | number | boolean | undefined> & {
  label: string
  runName: string
  venueName: string
  isCurrent: boolean
}
type TeamAssessmentTooltipPayload = ReadonlyArray<{
  payload?: {
    venueName?: unknown
  }
}>

function formatTrendTooltipLabel(
  fallbackLabel: React.ReactNode,
  payload: TeamAssessmentTooltipPayload,
): React.ReactNode {
  const venueName = payload[0]?.payload?.venueName

  if (typeof venueName === "string" && venueName.trim().length > 0) {
    return venueName
  }

  return fallbackLabel
}

function VenueAxisTick({
  payload,
  venueNameByLabel,
  x = 0,
  y = 0,
}: {
  payload?: {
    value?: string | number
  }
  venueNameByLabel: Map<string, string>
  x?: number
  y?: number
}) {
  const label = String(payload?.value ?? "")
  const venueName = venueNameByLabel.get(label)

  return (
    <text x={x} y={y} dy={16} textAnchor="middle">
      {venueName ? <title>{venueName}</title> : null}
      {label}
    </text>
  )
}

function buildInitialModeByCategoryId(
  categories: TeamAssessmentRun["categories"],
): Record<string, string> {
  const modeByCategoryId: Record<string, string> = {}

  for (const category of categories) {
    const firstMode = category.modes?.[0]

    if (firstMode) {
      modeByCategoryId[category.id] = firstMode.id
    }
  }

  return modeByCategoryId
}

function categoryUsesModes(category: TeamAssessmentCategory | null): boolean {
  return (category?.modes?.length ?? 0) > 0
}

function getSelectedMode(input: {
  category: TeamAssessmentCategory | null
  modeByCategoryId: Record<string, string>
}): TeamAssessmentMode | null {
  if (!categoryUsesModes(input.category) || !input.category) {
    return null
  }

  return (
    input.category.modes?.find(
      (mode) => mode.id === input.modeByCategoryId[input.category?.id ?? ""],
    ) ??
    input.category.modes?.[0] ??
    null
  )
}

function getQuestionsForSelection(input: {
  category: TeamAssessmentCategory | null
  mode: TeamAssessmentMode | null
}): TeamAssessmentQuestion[] {
  if (!input.category) {
    return []
  }

  if (categoryUsesModes(input.category)) {
    return input.mode?.questions ?? []
  }

  return input.category.questions
}

function getFirstQuestionIdForSelection(input: {
  category: TeamAssessmentCategory | null
  mode: TeamAssessmentMode | null
}): string {
  return getQuestionsForSelection(input)[0]?.id ?? ""
}

function getSelectTriggerWidthStyle(labels: string[]): React.CSSProperties {
  const longestLabelLength = Math.max(1, ...labels.map((label) => label.length))

  return {
    maxWidth: "100%",
    width: `min(100%, calc(${longestLabelLength}ch + 4.5rem))`,
  }
}

function findAnalyticsItem(input: {
  detail: TeamAssessmentDetailData
  questionId: string
}): TeamAssessmentAnalyticsItem | null {
  return (
    input.detail.analytics.items.find((item) => item.questionId === input.questionId) ??
    null
  )
}

function getAnalyticsItemsForSelection(input: {
  detail: TeamAssessmentDetailData
  categoryId: string | null
  modeId: string | null
}): TeamAssessmentAnalyticsItem[] {
  return input.detail.analytics.items
    .filter(
      (item) =>
        item.categoryId === input.categoryId &&
        (input.modeId ? item.modeId === input.modeId : item.modeId === null),
    )
    .sort((left, right) => left.position - right.position)
}

function QuestionScoreRow({
  question,
  run,
  selectedValue,
  setValue,
}: {
  question: TeamAssessmentQuestion
  run: TeamAssessmentRun
  selectedValue: string
  setValue: (questionId: string, value: string) => void
}) {
  return (
    <article className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">{question.prompt}</p>
      <div className="flex flex-wrap gap-2">
        {run.scaleOptions.map((option) => {
          const isSelected = selectedValue === option.id

          return (
            <Button
              key={option.id}
              type="button"
              variant={isSelected ? "default" : "outline"}
              className="h-11 min-w-11 rounded-full md:h-8 md:min-w-8"
              onClick={() => setValue(question.id, option.id)}
            >
              {option.label}
            </Button>
          )
        })}
        <Button
          type="button"
          variant="ghost"
          className="h-11 md:h-8"
          disabled={selectedValue.length === 0}
          onClick={() => setValue(question.id, "")}
        >
          Clear
        </Button>
      </div>
    </article>
  )
}

function AssessmentModeSelect({
  category,
  idPrefix,
  onModeChange,
  selectedMode,
}: {
  category: TeamAssessmentCategory | null
  idPrefix: string
  onModeChange: (modeId: string) => void
  selectedMode: TeamAssessmentMode | null
}) {
  if (!categoryUsesModes(category) || !category) {
    return null
  }

  const modes = category.modes ?? []

  return (
    <div>
      <Select
        value={selectedMode?.id ?? ""}
        onValueChange={(value) => onModeChange(String(value))}
      >
        <SelectTrigger
          id={`${idPrefix}-mode`}
          className="max-w-full"
          style={getSelectTriggerWidthStyle([
            ...modes.map((mode) => mode.name),
            "Mode",
          ])}
          aria-label="Mode"
        >
          <SelectValue>{selectedMode?.name ?? "Mode"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {modes.map((mode) => (
            <SelectItem key={mode.id} value={mode.id}>
              {mode.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function AssessmentSelectionControls({
  categoryLabel = "Category",
  className,
  idPrefix,
  itemLabel = "Item",
  onCategoryChange,
  onModeChange,
  onQuestionChange,
  questions,
  run,
  selectedCategory,
  selectedMode,
  selectedQuestionId,
  showQuestionSelect,
}: {
  categoryLabel?: string
  className?: string
  idPrefix: string
  itemLabel?: string
  onCategoryChange: (categoryId: string) => void
  onModeChange: (modeId: string) => void
  onQuestionChange?: (questionId: string) => void
  questions: TeamAssessmentQuestion[]
  run: TeamAssessmentRun
  selectedCategory: TeamAssessmentCategory | null
  selectedMode: TeamAssessmentMode | null
  selectedQuestionId?: string
  showQuestionSelect?: boolean
}) {
  const categoryNames = [
    ...run.categories.map((category) => category.name),
    "Select category",
  ]
  const questionLabels = [
    ...questions.map((question) => question.prompt),
    "Select item",
  ]

  return (
    <div
      className={cn(
        "grid gap-3 md:grid-cols-[max-content_max-content_max-content] md:items-end",
        className,
      )}
    >
      <div>
        <Select
          value={selectedCategory?.id ?? ""}
          onValueChange={(value) => onCategoryChange(String(value))}
        >
          <SelectTrigger
            id={`${idPrefix}-category`}
            className="max-w-full"
            style={getSelectTriggerWidthStyle(categoryNames)}
            aria-label={categoryLabel}
          >
            <SelectValue>{selectedCategory?.name ?? "Select category"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {run.categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AssessmentModeSelect
        category={selectedCategory}
        idPrefix={idPrefix}
        selectedMode={selectedMode}
        onModeChange={onModeChange}
      />

      {showQuestionSelect ? (
        <div>
          <Select
            value={selectedQuestionId ?? ""}
            onValueChange={(value) => onQuestionChange?.(String(value))}
            disabled={questions.length === 0}
          >
            <SelectTrigger
              id={`${idPrefix}-question`}
              className="max-w-full"
              style={getSelectTriggerWidthStyle(questionLabels)}
              aria-label={itemLabel}
            >
              <SelectValue>
                {questions.find((question) => question.id === selectedQuestionId)?.prompt ??
                  "Select item"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {questions.map((question) => (
                <SelectItem key={question.id} value={question.id}>
                  {question.prompt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )
}

function AssessmentAnswerForm({
  returnPath,
  run,
  scope,
}: {
  returnPath: string
  run: TeamAssessmentRun
  scope: NavigationScope
}) {
  const [selectionByQuestionId, setSelectionByQuestionId] = React.useState<
    Record<string, string>
  >(() => buildInitialSelectionByQuestionId(run.myAnswers))
  const [selectedCategoryId, setSelectedCategoryId] = React.useState(
    () => run.categories[0]?.id ?? "",
  )
  const [modeByCategoryId, setModeByCategoryId] = React.useState<
    Record<string, string>
  >(() => buildInitialModeByCategoryId(run.categories))
  const payload = React.useMemo(
    () =>
      JSON.stringify(
        buildRunAnswerPayloadRows({
          categories: run.categories,
          selectionByQuestionId,
        }),
      ),
    [run.categories, selectionByQuestionId],
  )
  const selectedCategory =
    run.categories.find((category) => category.id === selectedCategoryId) ??
    run.categories[0] ??
    null
  const selectedMode = getSelectedMode({
    category: selectedCategory,
    modeByCategoryId,
  })
  const activeQuestions = getQuestionsForSelection({
    category: selectedCategory,
    mode: selectedMode,
  })

  function updateSelectedCategory(categoryId: string): void {
    const nextCategory =
      run.categories.find((category) => category.id === categoryId) ?? null
    const nextMode = getSelectedMode({
      category: nextCategory,
      modeByCategoryId,
    })

    setSelectedCategoryId(categoryId)

    if (nextCategory && categoryUsesModes(nextCategory) && nextMode) {
      setModeByCategoryId((currentValue) => ({
        ...currentValue,
        [nextCategory.id]: nextMode.id,
      }))
    }
  }

  function updateSelectedMode(modeId: string): void {
    if (!selectedCategory) {
      return
    }

    setModeByCategoryId((currentValue) => ({
      ...currentValue,
      [selectedCategory.id]: modeId,
    }))
  }

  function setValue(questionId: string, value: string): void {
    setSelectionByQuestionId((currentValue) => ({
      ...currentValue,
      [questionId]: value,
    }))
  }

  return (
    <GradientCard className="space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold">Your answers</h2>
        <p className="text-sm text-muted-foreground">
          Score each item from 1 to 5. Saving replaces your previous answers.
        </p>
      </div>

      <form action={submitAssessmentAnswersAction} className="space-y-4">
        <AssessmentScopeFields scope={scope} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <input type="hidden" name="runId" value={run.id} />
        <input type="hidden" name="teamVenueId" value={run.teamVenueId} />
        <input type="hidden" name="answersJson" value={payload} />

        <AssessmentSelectionControls
          idPrefix={`answer-${run.id}`}
          run={run}
          selectedCategory={selectedCategory}
          selectedMode={selectedMode}
          questions={activeQuestions}
          onCategoryChange={updateSelectedCategory}
          onModeChange={updateSelectedMode}
        />

        {activeQuestions.length > 0 ? (
          <div className="space-y-3">
            {activeQuestions.map((question) => (
              <QuestionScoreRow
                key={question.id}
                question={question}
                run={run}
                selectedValue={selectionByQuestionId[question.id] ?? ""}
                setValue={setValue}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No indicators are configured for this selection.
          </p>
        )}

        <div className="flex justify-end border-t pt-4">
          <AnswerSubmitButton />
        </div>
      </form>
    </GradientCard>
  )
}

function SelectedItemTrendChart({ item }: { item: TeamAssessmentAnalyticsItem | null }) {
  const rawGradientId = React.useId()
  const gradientRootId = `assessment-respondent-${rawGradientId.replace(/[^a-zA-Z0-9_-]/g, "")}`
  const chartConfig = React.useMemo<ChartConfig>(() => {
    const config: ChartConfig = {}

    for (const line of item?.respondentLines ?? []) {
      config[line.dataKey] = {
        label: line.label,
        color: getRespondentSeriesColorByDataKey(line.dataKey),
      }
    }

    return config
  }, [item])
  const chartData = React.useMemo(
    () =>
      (item?.trendPoints ?? []).map((point) => {
        const row: TeamAssessmentChartDatum = {
          label: point.label,
          runName: point.runName,
          venueName: point.venueName,
          isCurrent: point.isCurrent,
        }

        for (const line of item?.respondentLines ?? []) {
          row[line.dataKey] = point.respondentScores[line.profileId] ?? undefined
        }

        return row
      }),
    [item],
  )
  const venueNameByLabel = React.useMemo(
    () => new Map(chartData.map((point) => [point.label, point.venueName])),
    [chartData],
  )
  const hasData = chartData.some((point) =>
    Object.entries(point).some(
      ([key, value]) =>
        key !== "label" &&
        key !== "runName" &&
        key !== "venueName" &&
        key !== "isCurrent" &&
        typeof value === "number",
    ),
  )

  if (!item || !hasData) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No answers have been submitted for this item yet.
      </p>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-72 w-full">
      <AreaChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tick={<VenueAxisTick venueNameByLabel={venueNameByLabel} />}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          domain={[0, 5]}
          ticks={[0, 1, 2, 3, 4, 5]}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={formatTrendTooltipLabel}
            />
          }
        />
        <defs>
          {item.respondentLines.map((line) => (
            <linearGradient
              key={line.profileId}
              id={`${gradientRootId}-${line.dataKey}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={`var(--color-${line.dataKey})`}
                stopOpacity={0.75}
              />
              <stop
                offset="95%"
                stopColor={`var(--color-${line.dataKey})`}
                stopOpacity={0.08}
              />
            </linearGradient>
          ))}
        </defs>
        {item.respondentLines.map((line) => (
          <Area
            key={line.profileId}
            dataKey={line.dataKey}
            type="natural"
            fill={`url(#${gradientRootId}-${line.dataKey})`}
            fillOpacity={0.3}
            stroke={`var(--color-${line.dataKey})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}

function getCrewRespondentsForItems(
  items: TeamAssessmentAnalyticsItem[],
  respondents: TeamAssessmentAnalyticsRespondent[],
): TeamAssessmentAnalyticsRespondent[] {
  const answeredProfileIds = new Set<string>()

  for (const item of items) {
    for (const answer of item.crewAnswers) {
      answeredProfileIds.add(answer.profileId)
    }
  }

  return respondents.filter((respondent) => answeredProfileIds.has(respondent.profileId))
}

function getCrewAnswerForItem(input: {
  item: TeamAssessmentAnalyticsItem
  profileId: string
}): TeamAssessmentCrewAnswer | null {
  return (
    input.item.crewAnswers.find((answer) => answer.profileId === input.profileId) ??
    null
  )
}

function AnswerMatrix({
  items,
  respondents,
}: {
  items: TeamAssessmentAnalyticsItem[]
  respondents: TeamAssessmentAnalyticsRespondent[]
}) {
  const crewRespondents = getCrewRespondentsForItems(items, respondents)

  return (
    <GradientCard className="overflow-hidden p-0">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h2 className="text-base font-semibold">Answers</h2>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No indicators are configured for this selection.
        </p>
      ) : crewRespondents.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No crew answers have been submitted for this selection.
        </p>
      ) : (
        <>
          <div className="hidden md:block">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-64">Indicator</TableHead>
                  {crewRespondents.map((respondent) => (
                    <TableHead key={respondent.profileId} className="min-w-28">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="size-2 rounded-full"
                          style={{
                            backgroundColor: getRespondentSeriesColorByDataKey(
                              respondent.dataKey,
                            ),
                          }}
                        />
                        <span>{respondent.label}</span>
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.questionId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{item.prompt}</span>
                        {item.isRequired ? (
                          <Badge variant="outline" className="h-5">
                            Required
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    {crewRespondents.map((respondent) => {
                      const answer = getCrewAnswerForItem({
                        item,
                        profileId: respondent.profileId,
                      })

                      return (
                        <TableCell
                          key={`${item.questionId}-${respondent.profileId}`}
                          className="font-mono tabular-nums"
                        >
                          {answer?.scaleLabel ?? "-"}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y divide-border md:hidden">
            {items.map((item) => (
              <article key={item.questionId} className="space-y-3 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{item.prompt}</p>
                  {item.isRequired ? (
                    <Badge variant="outline" className="h-5 shrink-0">
                      Required
                    </Badge>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {crewRespondents.map((respondent) => {
                    const answer = getCrewAnswerForItem({
                      item,
                      profileId: respondent.profileId,
                    })

                    return (
                      <div key={`${item.questionId}-${respondent.profileId}`}>
                        <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: getRespondentSeriesColorByDataKey(
                                respondent.dataKey,
                              ),
                            }}
                          />
                          <span className="min-w-0 truncate">{respondent.label}</span>
                        </p>
                        <p className="font-mono tabular-nums">
                          {answer?.scaleLabel ?? "-"}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </GradientCard>
  )
}

function AssessmentAnalyticsSection({ detail }: { detail: TeamAssessmentDetailData }) {
  const run = detail.run
  const [selectedCategoryId, setSelectedCategoryId] = React.useState(
    () => run.categories[0]?.id ?? "",
  )
  const [modeByCategoryId, setModeByCategoryId] = React.useState<
    Record<string, string>
  >(() => buildInitialModeByCategoryId(run.categories))
  const [selectedQuestionId, setSelectedQuestionId] = React.useState(() => {
    const category = run.categories[0] ?? null
    const mode = getSelectedMode({
      category,
      modeByCategoryId: buildInitialModeByCategoryId(run.categories),
    })

    return getFirstQuestionIdForSelection({ category, mode })
  })
  const selectedCategory =
    run.categories.find((category) => category.id === selectedCategoryId) ??
    run.categories[0] ??
    null
  const selectedMode = getSelectedMode({
    category: selectedCategory,
    modeByCategoryId,
  })
  const activeQuestions = getQuestionsForSelection({
    category: selectedCategory,
    mode: selectedMode,
  })
  const activeQuestionIds = activeQuestions.map((question) => question.id).join("|")
  const resolvedQuestionId = activeQuestions.some(
    (question) => question.id === selectedQuestionId,
  )
    ? selectedQuestionId
    : activeQuestions[0]?.id ?? ""
  const selectedItem = findAnalyticsItem({
    detail,
    questionId: resolvedQuestionId,
  })
  const matrixItems = getAnalyticsItemsForSelection({
    detail,
    categoryId: selectedCategory?.id ?? null,
    modeId: selectedMode?.id ?? null,
  })

  React.useEffect(() => {
    if (resolvedQuestionId !== selectedQuestionId) {
      setSelectedQuestionId(resolvedQuestionId)
    }
  }, [activeQuestionIds, resolvedQuestionId, selectedQuestionId])

  function updateSelectedCategory(categoryId: string): void {
    const nextCategory =
      run.categories.find((category) => category.id === categoryId) ?? null
    const nextMode = getSelectedMode({
      category: nextCategory,
      modeByCategoryId,
    })

    setSelectedCategoryId(categoryId)
    setSelectedQuestionId(
      getFirstQuestionIdForSelection({
        category: nextCategory,
        mode: nextMode,
      }),
    )
  }

  function updateSelectedMode(modeId: string): void {
    if (!selectedCategory) {
      return
    }

    const nextMode =
      selectedCategory.modes?.find((mode) => mode.id === modeId) ?? null

    setModeByCategoryId((currentValue) => ({
      ...currentValue,
      [selectedCategory.id]: modeId,
    }))
    setSelectedQuestionId(
      getFirstQuestionIdForSelection({
        category: selectedCategory,
        mode: nextMode,
      }),
    )
  }

  return (
    <section className="space-y-4">
      <GradientCard className="space-y-4 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="shrink-0">
            <h2 className="text-base font-semibold">Analytics</h2>
          </div>

          <AssessmentSelectionControls
            className="xl:ml-auto xl:w-auto"
            idPrefix={`analytics-${run.id}`}
            run={run}
            selectedCategory={selectedCategory}
            selectedMode={selectedMode}
            selectedQuestionId={resolvedQuestionId}
            questions={activeQuestions}
            showQuestionSelect
            onCategoryChange={updateSelectedCategory}
            onModeChange={updateSelectedMode}
            onQuestionChange={setSelectedQuestionId}
          />
        </div>

        <SelectedItemTrendChart item={selectedItem} />
      </GradientCard>

      <AnswerMatrix
        items={matrixItems}
        respondents={detail.analytics.respondentSummaries}
      />
    </section>
  )
}

export function AssessmentDetailClient({
  canManageAssessments,
  detail,
  scope,
}: {
  canManageAssessments: boolean
  detail: TeamAssessmentDetailData
  scope: NavigationScope
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentHref = normalizeInternalHref(
    searchParams.toString().length > 0
      ? `${pathname}?${searchParams.toString()}`
      : pathname,
  )
  const run = detail.run
  const canAnswer = run.status === "published" && run.isRespondent

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {run.templateName ?? run.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {run.venueName}
              </span>
              {run.camps.map((camp) => (
                <Badge key={camp.id} variant="secondary">
                  {camp.name}
                </Badge>
              ))}
            </div>
          </div>

          <AssessmentDetailActions
            canManageAssessments={canManageAssessments}
            returnPath={currentHref}
            run={run}
            scope={scope}
          />
        </div>
      </section>

      <AssessmentAnalyticsSection detail={detail} />

      {canAnswer ? (
        <AssessmentAnswerForm returnPath={currentHref} run={run} scope={scope} />
      ) : run.status === "published" ? (
        <p className="text-sm text-muted-foreground">
          You are not in the respondent list for this assessment.
        </p>
      ) : null}
    </div>
  )
}
