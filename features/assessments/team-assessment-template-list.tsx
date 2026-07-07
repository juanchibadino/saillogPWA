"use client"

import * as React from "react"
import Link from "next/link"

import { formatDateTimeLabel } from "@/features/assessments/assessment-formatters"
import type { TeamAssessmentTemplate } from "@/features/assessments/data"
import { buildTeamAssessmentsHref } from "@/features/assessments/navigation"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"
import { GradientCard } from "@/components/shared/gradient-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function countTemplateItems(template: TeamAssessmentTemplate): {
  categoryCount: number
  modeCount: number
  questionCount: number
} {
  return template.categories.reduce(
    (summary, category) => {
      const modeCount = category.modes?.length ?? 0
      const modeQuestionCount = (category.modes ?? []).reduce(
        (count, mode) => count + mode.questions.length,
        0,
      )

      return {
        categoryCount: summary.categoryCount + 1,
        modeCount: summary.modeCount + modeCount,
        questionCount:
          summary.questionCount + category.questions.length + modeQuestionCount,
      }
    },
    {
      categoryCount: 0,
      modeCount: 0,
      questionCount: 0,
    },
  )
}

function shouldHandleTemplateNavigation(
  event: React.MouseEvent<HTMLAnchorElement>,
): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
  )
}

export function TeamAssessmentTemplateList({
  onTemplateOpen,
  scope,
  selectedTemplateId,
  templates,
}: {
  onTemplateOpen?: (href: string) => void
  scope: NavigationScope
  selectedTemplateId?: string
  templates: TeamAssessmentTemplate[]
}) {
  return (
    <section className="space-y-3">
      <div className="md:hidden">
        {templates.length === 0 ? (
          <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
            No templates for this team yet.
          </GradientCard>
        ) : (
          <div className="space-y-2">
            {templates.map((template) => {
              const counts = countTemplateItems(template)
              const href = buildTeamAssessmentsHref({
                scope,
                tab: "templates",
                templateId: template.id,
              })

              return (
                <Link
                  key={template.id}
                  href={href}
                  onClick={(event) => {
                    if (!onTemplateOpen || !shouldHandleTemplateNavigation(event)) {
                      return
                    }

                    event.preventDefault()
                    onTemplateOpen(href)
                  }}
                >
                  <GradientCard
                    className={cn(
                      "px-3 py-3 transition-colors hover:bg-muted/30",
                      selectedTemplateId === template.id && "border-primary/60",
                    )}
                  >
                    <p className="truncate text-sm font-semibold">{template.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {counts.categoryCount} categories
                      {counts.modeCount > 0 ? ` - ${counts.modeCount} modes` : ""} -{" "}
                      {counts.questionCount} items
                    </p>
                  </GradientCard>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <GradientCard className="hidden overflow-hidden p-0 md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Template</TableHead>
              <TableHead>Structure</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-sm text-muted-foreground">
                  No templates for this team yet.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => {
                const counts = countTemplateItems(template)
                const href = buildTeamAssessmentsHref({
                  scope,
                  tab: "templates",
                  templateId: template.id,
                })

                return (
                  <TableRow
                    key={template.id}
                    className={cn(
                      "cursor-pointer",
                      selectedTemplateId === template.id && "bg-muted/50",
                    )}
                    onClick={onTemplateOpen ? () => onTemplateOpen(href) : undefined}
                  >
                    <TableCell className="font-medium">
                      <Link
                        href={href}
                        className="underline-offset-4 hover:underline"
                        onClick={(event) => {
                          event.stopPropagation()

                          if (!onTemplateOpen || !shouldHandleTemplateNavigation(event)) {
                            return
                          }

                          event.preventDefault()
                          onTemplateOpen(href)
                        }}
                      >
                        {template.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {counts.categoryCount} categories
                      {counts.modeCount > 0 ? ` - ${counts.modeCount} modes` : ""} -{" "}
                      {counts.questionCount} items
                    </TableCell>
                    <TableCell>{formatDateTimeLabel(template.updatedAt)}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </GradientCard>
    </section>
  )
}
