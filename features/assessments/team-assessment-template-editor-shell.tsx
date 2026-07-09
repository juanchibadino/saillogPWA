"use client"

import { AssessmentTemplateEditor } from "@/features/assessments/template-editor"
import { TeamAssessmentTemplateList } from "@/features/assessments/team-assessment-template-list"
import type { TeamAssessmentTemplate } from "@/features/assessments/data"
import type { NavigationScope } from "@/lib/navigation/types"

export function TeamAssessmentTemplateEditorShell({
  cancelHref,
  canManageAssessments,
  creatingTemplate,
  onCancel,
  onTemplateOpen,
  scope,
  selectedTemplateId,
  templates,
}: {
  cancelHref: string
  canManageAssessments: boolean
  creatingTemplate: boolean
  onCancel?: (href: string) => void
  onTemplateOpen?: (href: string) => void
  scope: NavigationScope
  selectedTemplateId?: string
  templates: TeamAssessmentTemplate[]
}) {
  const selectedTemplate = selectedTemplateId
    ? templates.find((template) => template.id === selectedTemplateId)
    : undefined
  const shouldShowEditor =
    canManageAssessments && (creatingTemplate || Boolean(selectedTemplate))

  if (shouldShowEditor) {
    return (
      <AssessmentTemplateEditor
        key={selectedTemplate?.id ?? "new-template"}
        cancelHref={cancelHref}
        onCancel={onCancel}
        scope={scope}
        template={selectedTemplate}
      />
    )
  }

  return (
    <div>
      <TeamAssessmentTemplateList
        canManageAssessments={canManageAssessments}
        onTemplateOpen={onTemplateOpen}
        scope={scope}
        selectedTemplateId={selectedTemplateId}
        templates={templates}
      />
    </div>
  )
}
