"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowLeftIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react"
import { useFormStatus } from "react-dom"

import {
  closeAssessmentRunAction,
  deleteAssessmentRunAction,
  submitAssessmentAnswersAction,
} from "@/features/assessments/actions"
import {
  buildTeamAssessmentsHref,
} from "@/features/assessments/navigation"
import type {
  TeamAssessmentDetailData,
  TeamAssessmentQuestion,
  TeamAssessmentRun,
} from "@/features/assessments/data"
import type { NavigationScope } from "@/lib/navigation/types"
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

const progressChartConfig = {
  average: {
    label: "Average",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

const categoryChartConfig = {
  currentAverage: {
    label: "Current",
    color: "var(--chart-1)",
  },
  historicalAverage: {
    label: "Historical",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

function formatAssessmentRunStatusLabel(status: TeamAssessmentRun["status"]): string {
  if (status === "published") {
    return "Published"
  }

  if (status === "closed") {
    return "Completed"
  }

  return "Draft"
}

function getStatusBadgeVariant(
  status: TeamAssessmentRun["status"],
): "secondary" | "default" | "outline" {
  if (status === "published") {
    return "default"
  }

  if (status === "closed") {
    return "secondary"
  }

  return "outline"
}

function formatDateTimeLabel(value: string | null): string {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
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

function CloseRunMenuItem() {
  const { pending } = useFormStatus()

  return (
    <DropdownMenuItem
      nativeButton
      render={<button type="submit" disabled={pending} />}
      disabled={pending}
    >
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {pending ? "Closing..." : "Close"}
    </DropdownMenuItem>
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
          {run.status !== "closed" ? (
            <form action={closeAssessmentRunAction}>
              <AssessmentScopeFields scope={scope} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <input type="hidden" name="runId" value={run.id} />
              <input type="hidden" name="teamVenueId" value={run.teamVenueId} />
              <CloseRunMenuItem />
            </form>
          ) : null}
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

        <div className="space-y-4">
          {run.categories.map((category) => (
            <section key={category.id} className="space-y-3">
              <h3 className="text-sm font-semibold">{category.name}</h3>
              {category.questions.map((question) => (
                <QuestionScoreRow
                  key={question.id}
                  question={question}
                  run={run}
                  selectedValue={selectionByQuestionId[question.id] ?? ""}
                  setValue={setValue}
                />
              ))}
              {(category.modes ?? []).map((mode) => (
                <div key={mode.id} className="space-y-3 rounded-lg border p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {mode.name}
                  </h4>
                  {mode.questions.map((question) => (
                    <QuestionScoreRow
                      key={question.id}
                      question={question}
                      run={run}
                      selectedValue={selectionByQuestionId[question.id] ?? ""}
                      setValue={setValue}
                    />
                  ))}
                </div>
              ))}
            </section>
          ))}
        </div>

        <div className="flex justify-end border-t pt-4">
          <AnswerSubmitButton />
        </div>
      </form>
    </GradientCard>
  )
}

function ProgressCharts({ detail }: { detail: TeamAssessmentDetailData }) {
  const progressData = detail.progressPoints.map((point) => ({
    ...point,
    marker: point.isCurrent ? "Current" : "",
  }))
  const categoryData = detail.categoryProgress.map((category) => ({
    categoryName: category.categoryName,
    currentAverage: category.currentAverage ?? 0,
    historicalAverage: category.historicalAverage ?? 0,
  }))

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <GradientCard className="space-y-3 p-4">
        <div>
          <h2 className="text-base font-semibold">Progress by assessment</h2>
          <p className="text-sm text-muted-foreground">
            Same team and template, ordered by creation date.
          </p>
        </div>
        {detail.progressPoints.some((point) => point.average !== null) ? (
          <ChartContainer config={progressChartConfig} className="h-72 w-full">
            <LineChart accessibilityLayer data={progressData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="average"
                type="monotone"
                stroke="var(--color-average)"
                strokeWidth={2}
                dot={(props) => {
                  const payload = props.payload as { isCurrent?: boolean }
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={payload.isCurrent ? 5 : 3}
                      fill="var(--color-average)"
                      stroke="var(--background)"
                      strokeWidth={2}
                    />
                  )
                }}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No answers have been submitted yet.
          </p>
        )}
      </GradientCard>

      <GradientCard className="space-y-3 p-4">
        <div>
          <h2 className="text-base font-semibold">Category comparison</h2>
          <p className="text-sm text-muted-foreground">
            Current run compared with previous runs using this template.
          </p>
        </div>
        {detail.categoryProgress.length > 0 ? (
          <ChartContainer config={categoryChartConfig} className="h-72 w-full">
            <BarChart accessibilityLayer data={categoryData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="categoryName"
                tickLine={false}
                axisLine={false}
                interval={0}
                tickMargin={8}
              />
              <YAxis domain={[0, 5]} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="historicalAverage" fill="var(--color-historicalAverage)" radius={3} />
              <Bar dataKey="currentAverage" fill="var(--color-currentAverage)" radius={3} />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No category data is available for this assessment.
          </p>
        )}
      </GradientCard>
    </div>
  )
}

function AnswerSummaries({ detail }: { detail: TeamAssessmentDetailData }) {
  return (
    <GradientCard className="overflow-hidden p-0">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h2 className="text-base font-semibold">Answer summary</h2>
      </div>
      {detail.questionSummaries.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No questions configured.</p>
      ) : (
        <div className="divide-y divide-border">
          {detail.questionSummaries.map((summary) => (
            <article
              key={summary.questionId}
              className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_7rem_6rem]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{summary.prompt}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.categoryName}
                  {summary.modeName ? ` - ${summary.modeName}` : ""}
                </p>
              </div>
              <p className="text-sm tabular-nums">
                Average: {summary.average === null ? "-" : summary.average.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {summary.answerCount} answers
              </p>
            </article>
          ))}
        </div>
      )}
    </GradientCard>
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
  const listHref = buildTeamAssessmentsHref({
    scope,
    tab: "created",
  })
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
          <div className="min-w-0 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={listHref} />}
            >
              <ArrowLeftIcon className="size-4" />
              Assessments
            </Button>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {run.templateName ?? run.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getStatusBadgeVariant(run.status)}>
                  {formatAssessmentRunStatusLabel(run.status)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {run.venueName} - {run.venueLocation}
                </span>
              </div>
            </div>
          </div>

          <AssessmentDetailActions
            canManageAssessments={canManageAssessments}
            returnPath={currentHref}
            run={run}
            scope={scope}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <GradientCard className="p-4">
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="mt-1 text-sm font-medium">{formatDateTimeLabel(run.createdAt)}</p>
          </GradientCard>
          <GradientCard className="p-4">
            <p className="text-xs text-muted-foreground">Published</p>
            <p className="mt-1 text-sm font-medium">{formatDateTimeLabel(run.publishedAt)}</p>
          </GradientCard>
          <GradientCard className="p-4">
            <p className="text-xs text-muted-foreground">Progress</p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {run.completedRespondentsCount}/{run.expectedRespondentsCount}
            </p>
          </GradientCard>
          <GradientCard className="p-4">
            <p className="text-xs text-muted-foreground">Camps</p>
            <p className="mt-1 text-sm font-medium">{run.camps.length}</p>
          </GradientCard>
        </div>
      </section>

      {run.camps.length > 0 ? (
        <GradientCard className="p-4">
          <h2 className="text-base font-semibold">Linked camps</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {run.camps.map((camp) => (
              <Badge key={camp.id} variant="secondary">
                {camp.name}
              </Badge>
            ))}
          </div>
        </GradientCard>
      ) : null}

      <ProgressCharts detail={detail} />
      <AnswerSummaries detail={detail} />

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
