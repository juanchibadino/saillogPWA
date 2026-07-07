import "server-only"

import {
  formatTeamAssessmentsListTimingError,
  logTeamAssessmentsListTiming,
  startTeamAssessmentsListTiming,
} from "@/features/assessments/list-timing"
import { resolveAssessmentPagination } from "@/features/assessments/list-route-state.mjs"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id"
const VENUE_SELECT_COLUMNS = "id,name,city,country"
const CAMP_SELECT_COLUMNS =
  "id,team_venue_id,name,start_date,end_date,is_active,created_at"
const ASSESSMENT_TEMPLATE_SELECT_COLUMNS =
  "id,team_id,name,description,is_active,updated_at"
const ASSESSMENT_TEMPLATE_SCALE_OPTION_SELECT_COLUMNS =
  "id,assessment_template_id,label,position"
const ASSESSMENT_TEMPLATE_CATEGORY_SELECT_COLUMNS =
  "id,assessment_template_id,name,position"
const ASSESSMENT_TEMPLATE_MODE_SELECT_COLUMNS =
  "id,assessment_template_category_id,name,position"
const ASSESSMENT_TEMPLATE_QUESTION_SELECT_COLUMNS =
  "id,assessment_template_category_id,assessment_template_mode_id,prompt,position,is_required"
const ASSESSMENT_RUN_SELECT_COLUMNS =
  "id,team_id,team_venue_id,assessment_template_id,name,description,status,published_at,closed_at,created_at"
const ASSESSMENT_RUN_SCALE_OPTION_SELECT_COLUMNS =
  "id,assessment_run_id,label,position"
const ASSESSMENT_RUN_CATEGORY_SELECT_COLUMNS =
  "id,assessment_run_id,name,position"
const ASSESSMENT_RUN_MODE_SELECT_COLUMNS = "id,assessment_run_category_id,name,position"
const ASSESSMENT_RUN_QUESTION_SELECT_COLUMNS =
  "id,assessment_run_category_id,assessment_run_mode_id,prompt,position,is_required"
const ASSESSMENT_RUN_CAMP_SELECT_COLUMNS = "assessment_run_id,camp_id"
const ASSESSMENT_RUN_RESPONDENT_SELECT_COLUMNS =
  "assessment_run_id,profile_id,responded_at"
const ASSESSMENT_RUN_ANSWER_SELECT_COLUMNS =
  "assessment_run_id,assessment_run_question_id,respondent_profile_id,assessment_run_scale_option_id"

export const TEAM_ASSESSMENTS_PAGE_SIZE = 10
const DETAIL_COMPARISON_RUN_LIMIT = 50

type TeamVenueRow = Pick<
  Database["public"]["Tables"]["team_venues"]["Row"],
  "id" | "team_id" | "venue_id"
>

type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name" | "city" | "country"
>

type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id" | "team_venue_id" | "name" | "start_date" | "end_date" | "is_active" | "created_at"
>

type AssessmentTemplateRow = Pick<
  Database["public"]["Tables"]["assessment_templates"]["Row"],
  "id" | "team_id" | "name" | "description" | "is_active" | "updated_at"
>

type AssessmentTemplateScaleOptionRow = Pick<
  Database["public"]["Tables"]["assessment_template_scale_options"]["Row"],
  "id" | "assessment_template_id" | "label" | "position"
>

type AssessmentTemplateCategoryRow = Pick<
  Database["public"]["Tables"]["assessment_template_categories"]["Row"],
  "id" | "assessment_template_id" | "name" | "position"
>

type AssessmentTemplateModeRow = Pick<
  Database["public"]["Tables"]["assessment_template_modes"]["Row"],
  "id" | "assessment_template_category_id" | "name" | "position"
>

type AssessmentTemplateQuestionRow = Pick<
  Database["public"]["Tables"]["assessment_template_questions"]["Row"],
  | "id"
  | "assessment_template_category_id"
  | "assessment_template_mode_id"
  | "prompt"
  | "position"
  | "is_required"
>

type AssessmentRunRow = Pick<
  Database["public"]["Tables"]["assessment_runs"]["Row"],
  | "id"
  | "team_id"
  | "team_venue_id"
  | "assessment_template_id"
  | "name"
  | "description"
  | "status"
  | "published_at"
  | "closed_at"
  | "created_at"
>

type AssessmentRunScaleOptionRow = Pick<
  Database["public"]["Tables"]["assessment_run_scale_options"]["Row"],
  "id" | "assessment_run_id" | "label" | "position"
>

type AssessmentRunCategoryRow = Pick<
  Database["public"]["Tables"]["assessment_run_categories"]["Row"],
  "id" | "assessment_run_id" | "name" | "position"
>

type AssessmentRunModeRow = Pick<
  Database["public"]["Tables"]["assessment_run_modes"]["Row"],
  "id" | "assessment_run_category_id" | "name" | "position"
>

type AssessmentRunQuestionRow = Pick<
  Database["public"]["Tables"]["assessment_run_questions"]["Row"],
  | "id"
  | "assessment_run_category_id"
  | "assessment_run_mode_id"
  | "prompt"
  | "position"
  | "is_required"
>

type AssessmentRunCampRow = Pick<
  Database["public"]["Tables"]["assessment_run_camps"]["Row"],
  "assessment_run_id" | "camp_id"
>

type AssessmentRunRespondentRow = Pick<
  Database["public"]["Tables"]["assessment_run_respondents"]["Row"],
  "assessment_run_id" | "profile_id" | "responded_at"
>

type AssessmentRunAnswerRow = Pick<
  Database["public"]["Tables"]["assessment_run_answers"]["Row"],
  | "assessment_run_id"
  | "assessment_run_question_id"
  | "respondent_profile_id"
  | "assessment_run_scale_option_id"
>

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export type TeamAssessmentScaleOption = {
  id: string
  label: string
  position: number
}

export type TeamAssessmentQuestion = {
  id: string
  prompt: string
  position: number
  isRequired: boolean
}

export type TeamAssessmentMode = {
  id: string
  name: string
  position: number
  questions: TeamAssessmentQuestion[]
}

export type TeamAssessmentCategory = {
  id: string
  name: string
  position: number
  questions: TeamAssessmentQuestion[]
  modes?: TeamAssessmentMode[]
}

export type TeamAssessmentTemplate = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  updatedAt: string
  scaleOptions: TeamAssessmentScaleOption[]
  categories: TeamAssessmentCategory[]
}

export type TeamAssessmentTemplateOption = {
  id: string
  name: string
}

export type TeamAssessmentVenueOption = {
  teamVenueId: string
  venueId: string
  venueName: string
  venueLocation: string
}

export type TeamAssessmentCampOption = {
  campId: string
  teamVenueId: string
  campName: string
  startDate: string
  endDate: string
  isActive: boolean
  dateRangeLabel: string
}

export type TeamAssessmentRunCamp = {
  id: string
  name: string
  startDate: string
  endDate: string
}

export type TeamAssessmentRunAnswer = {
  questionId: string
  scaleOptionId: string
}

export type TeamAssessmentRunAllAnswer = {
  questionId: string
  scaleOptionId: string
  respondentProfileId: string
}

export type TeamAssessmentRun = {
  id: string
  name: string
  description: string | null
  status: Database["public"]["Enums"]["assessment_run_status_type"]
  templateId: string | null
  templateName: string | null
  teamVenueId: string
  venueName: string
  venueLocation: string
  publishedAt: string | null
  closedAt: string | null
  createdAt: string
  camps: TeamAssessmentRunCamp[]
  scaleOptions: TeamAssessmentScaleOption[]
  categories: TeamAssessmentCategory[]
  expectedRespondentsCount: number
  completedRespondentsCount: number
  isRespondent: boolean
  myRespondedAt: string | null
  myAnswers: TeamAssessmentRunAnswer[]
  allAnswers: TeamAssessmentRunAllAnswer[]
}

export type TeamAssessmentPagination = {
  currentPage: number
  pageCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export type TeamAssessmentsPageData = {
  venueOptions: TeamAssessmentVenueOption[]
  campOptions: TeamAssessmentCampOption[]
  templateOptions: TeamAssessmentTemplateOption[]
  templates: TeamAssessmentTemplate[]
  runs: TeamAssessmentRun[]
  pagination: TeamAssessmentPagination
}

export type TeamAssessmentsCreatedTabData = {
  venueOptions: TeamAssessmentVenueOption[]
  campOptions: TeamAssessmentCampOption[]
  templateOptions: TeamAssessmentTemplateOption[]
  runs: TeamAssessmentRun[]
  pagination: TeamAssessmentPagination
}

export type TeamAssessmentsTemplatesTabData = {
  templates: TeamAssessmentTemplate[]
}

export type TeamAssessmentProgressPoint = {
  runId: string
  label: string
  average: number | null
  isCurrent: boolean
}

export type TeamAssessmentCategoryProgress = {
  categoryName: string
  currentAverage: number | null
  historicalAverage: number | null
  delta: number | null
}

export type TeamAssessmentQuestionSummary = {
  questionId: string
  categoryName: string
  modeName: string | null
  prompt: string
  average: number | null
  answerCount: number
}

export type TeamAssessmentDetailData = {
  run: TeamAssessmentRun
  comparisonRuns: TeamAssessmentRun[]
  progressPoints: TeamAssessmentProgressPoint[]
  categoryProgress: TeamAssessmentCategoryProgress[]
  questionSummaries: TeamAssessmentQuestionSummary[]
}

type TeamVenueContext = {
  venueOptions: TeamAssessmentVenueOption[]
  campOptions: TeamAssessmentCampOption[]
  teamVenueRows: TeamVenueRow[]
  teamVenueById: Map<string, TeamVenueRow>
  venueById: Map<string, VenueRow>
  campById: Map<string, CampRow>
}

function uniqueIds(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function buildLocation(venue: Pick<VenueRow, "city" | "country">): string {
  return `${venue.city}, ${venue.country}`
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`))
}

function buildDateRangeLabel(input: { startDate: string; endDate: string }): string {
  if (input.startDate === input.endDate) {
    return formatDateLabel(input.startDate)
  }

  return `${formatDateLabel(input.startDate)} - ${formatDateLabel(input.endDate)}`
}

function sortByPosition<T extends { position: number }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.position - right.position)
}

function buildTemplateCategories(input: {
  categories: AssessmentTemplateCategoryRow[]
  modes: AssessmentTemplateModeRow[]
  questions: AssessmentTemplateQuestionRow[]
}): TeamAssessmentCategory[] {
  const questionsByCategoryId = new Map<string, AssessmentTemplateQuestionRow[]>()
  const questionsByModeId = new Map<string, AssessmentTemplateQuestionRow[]>()
  const modesByCategoryId = new Map<string, AssessmentTemplateModeRow[]>()

  for (const question of input.questions) {
    if (question.assessment_template_mode_id) {
      const existingRows = questionsByModeId.get(question.assessment_template_mode_id) ?? []
      existingRows.push(question)
      questionsByModeId.set(question.assessment_template_mode_id, existingRows)
      continue
    }

    const existingRows = questionsByCategoryId.get(question.assessment_template_category_id) ?? []
    existingRows.push(question)
    questionsByCategoryId.set(question.assessment_template_category_id, existingRows)
  }

  for (const mode of input.modes) {
    const existingRows = modesByCategoryId.get(mode.assessment_template_category_id) ?? []
    existingRows.push(mode)
    modesByCategoryId.set(mode.assessment_template_category_id, existingRows)
  }

  return sortByPosition(input.categories).map((category) => {
    const modes = sortByPosition(modesByCategoryId.get(category.id) ?? []).map((mode) => ({
      id: mode.id,
      name: mode.name,
      position: mode.position,
      questions: sortByPosition(questionsByModeId.get(mode.id) ?? []).map((question) => ({
        id: question.id,
        prompt: question.prompt,
        position: question.position,
        isRequired: question.is_required,
      })),
    }))

    return {
      id: category.id,
      name: category.name,
      position: category.position,
      questions: sortByPosition(questionsByCategoryId.get(category.id) ?? []).map((question) => ({
        id: question.id,
        prompt: question.prompt,
        position: question.position,
        isRequired: question.is_required,
      })),
      modes,
    }
  })
}

function buildTemplates(input: {
  templates: AssessmentTemplateRow[]
  templateScaleOptions: AssessmentTemplateScaleOptionRow[]
  templateCategories: AssessmentTemplateCategoryRow[]
  templateModes: AssessmentTemplateModeRow[]
  templateQuestions: AssessmentTemplateQuestionRow[]
}): TeamAssessmentTemplate[] {
  const scaleOptionsByTemplateId = new Map<string, AssessmentTemplateScaleOptionRow[]>()
  const categoriesByTemplateId = new Map<string, AssessmentTemplateCategoryRow[]>()

  for (const scaleOption of input.templateScaleOptions) {
    const existingRows = scaleOptionsByTemplateId.get(scaleOption.assessment_template_id) ?? []
    existingRows.push(scaleOption)
    scaleOptionsByTemplateId.set(scaleOption.assessment_template_id, existingRows)
  }

  for (const category of input.templateCategories) {
    const existingRows = categoriesByTemplateId.get(category.assessment_template_id) ?? []
    existingRows.push(category)
    categoriesByTemplateId.set(category.assessment_template_id, existingRows)
  }

  return input.templates.map((template) => {
    const templateCategories = categoriesByTemplateId.get(template.id) ?? []

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      isActive: template.is_active,
      updatedAt: template.updated_at,
      scaleOptions: sortByPosition(scaleOptionsByTemplateId.get(template.id) ?? []).map(
        (option) => ({
          id: option.id,
          label: option.label,
          position: option.position,
        }),
      ),
      categories: buildTemplateCategories({
        categories: templateCategories,
        modes: input.templateModes.filter(
          (mode) =>
            templateCategories.findIndex(
              (category) => category.id === mode.assessment_template_category_id,
            ) >= 0,
        ),
        questions: input.templateQuestions.filter(
          (question) =>
            templateCategories.findIndex(
              (category) => category.id === question.assessment_template_category_id,
            ) >= 0,
        ),
      }),
    }
  })
}

function buildRunCategories(input: {
  categories: AssessmentRunCategoryRow[]
  modes: AssessmentRunModeRow[]
  questions: AssessmentRunQuestionRow[]
}): TeamAssessmentCategory[] {
  const questionsByCategoryId = new Map<string, AssessmentRunQuestionRow[]>()
  const questionsByModeId = new Map<string, AssessmentRunQuestionRow[]>()
  const modesByCategoryId = new Map<string, AssessmentRunModeRow[]>()

  for (const question of input.questions) {
    if (question.assessment_run_mode_id) {
      const existingRows = questionsByModeId.get(question.assessment_run_mode_id) ?? []
      existingRows.push(question)
      questionsByModeId.set(question.assessment_run_mode_id, existingRows)
      continue
    }

    const existingRows = questionsByCategoryId.get(question.assessment_run_category_id) ?? []
    existingRows.push(question)
    questionsByCategoryId.set(question.assessment_run_category_id, existingRows)
  }

  for (const mode of input.modes) {
    const existingRows = modesByCategoryId.get(mode.assessment_run_category_id) ?? []
    existingRows.push(mode)
    modesByCategoryId.set(mode.assessment_run_category_id, existingRows)
  }

  return sortByPosition(input.categories).map((category) => {
    const modes = sortByPosition(modesByCategoryId.get(category.id) ?? []).map((mode) => ({
      id: mode.id,
      name: mode.name,
      position: mode.position,
      questions: sortByPosition(questionsByModeId.get(mode.id) ?? []).map((question) => ({
        id: question.id,
        prompt: question.prompt,
        position: question.position,
        isRequired: question.is_required,
      })),
    }))

    return {
      id: category.id,
      name: category.name,
      position: category.position,
      questions: sortByPosition(questionsByCategoryId.get(category.id) ?? []).map((question) => ({
        id: question.id,
        prompt: question.prompt,
        position: question.position,
        isRequired: question.is_required,
      })),
      modes,
    }
  })
}

function buildRuns(input: {
  runs: AssessmentRunRow[]
  runScaleOptions: AssessmentRunScaleOptionRow[]
  runCategories: AssessmentRunCategoryRow[]
  runModes: AssessmentRunModeRow[]
  runQuestions: AssessmentRunQuestionRow[]
  runCamps: AssessmentRunCampRow[]
  runRespondents: AssessmentRunRespondentRow[]
  runAnswers: AssessmentRunAnswerRow[]
  campById: Map<string, CampRow>
  teamVenueById: Map<string, TeamVenueRow>
  venueById: Map<string, VenueRow>
  templateNameById: Map<string, string>
  currentProfileId: string
}): TeamAssessmentRun[] {
  const scaleOptionsByRunId = new Map<string, AssessmentRunScaleOptionRow[]>()
  const categoriesByRunId = new Map<string, AssessmentRunCategoryRow[]>()
  const campsByRunId = new Map<string, TeamAssessmentRunCamp[]>()
  const respondentsByRunId = new Map<string, AssessmentRunRespondentRow[]>()
  const answersByRunId = new Map<string, AssessmentRunAnswerRow[]>()

  for (const scaleOption of input.runScaleOptions) {
    const existingRows = scaleOptionsByRunId.get(scaleOption.assessment_run_id) ?? []
    existingRows.push(scaleOption)
    scaleOptionsByRunId.set(scaleOption.assessment_run_id, existingRows)
  }

  for (const category of input.runCategories) {
    const existingRows = categoriesByRunId.get(category.assessment_run_id) ?? []
    existingRows.push(category)
    categoriesByRunId.set(category.assessment_run_id, existingRows)
  }

  for (const runCamp of input.runCamps) {
    const camp = input.campById.get(runCamp.camp_id)

    if (!camp) {
      continue
    }

    const existingRows = campsByRunId.get(runCamp.assessment_run_id) ?? []
    existingRows.push({
      id: camp.id,
      name: camp.name,
      startDate: camp.start_date,
      endDate: camp.end_date,
    })
    campsByRunId.set(runCamp.assessment_run_id, existingRows)
  }

  for (const respondent of input.runRespondents) {
    const existingRows = respondentsByRunId.get(respondent.assessment_run_id) ?? []
    existingRows.push(respondent)
    respondentsByRunId.set(respondent.assessment_run_id, existingRows)
  }

  for (const answer of input.runAnswers) {
    const existingRows = answersByRunId.get(answer.assessment_run_id) ?? []
    existingRows.push(answer)
    answersByRunId.set(answer.assessment_run_id, existingRows)
  }

  return input.runs.map((run) => {
    const runCategories = categoriesByRunId.get(run.id) ?? []
    const respondents = respondentsByRunId.get(run.id) ?? []
    const answers = answersByRunId.get(run.id) ?? []
    const teamVenue = input.teamVenueById.get(run.team_venue_id)
    const venue = teamVenue ? input.venueById.get(teamVenue.venue_id) : undefined
    const myRespondent = respondents.find(
      (respondent) => respondent.profile_id === input.currentProfileId,
    )

    return {
      id: run.id,
      name: run.name,
      description: run.description,
      status: run.status,
      templateId: run.assessment_template_id,
      templateName: run.assessment_template_id
        ? (input.templateNameById.get(run.assessment_template_id) ?? null)
        : null,
      teamVenueId: run.team_venue_id,
      venueName: venue?.name ?? "Venue unavailable",
      venueLocation: venue ? buildLocation(venue) : "Unknown location",
      publishedAt: run.published_at,
      closedAt: run.closed_at,
      createdAt: run.created_at,
      camps: (campsByRunId.get(run.id) ?? []).sort((left, right) =>
        left.startDate.localeCompare(right.startDate),
      ),
      scaleOptions: sortByPosition(scaleOptionsByRunId.get(run.id) ?? []).map((option) => ({
        id: option.id,
        label: option.label,
        position: option.position,
      })),
      categories: buildRunCategories({
        categories: runCategories,
        modes: input.runModes.filter(
          (mode) =>
            runCategories.findIndex(
              (category) => category.id === mode.assessment_run_category_id,
            ) >= 0,
        ),
        questions: input.runQuestions.filter(
          (question) =>
            runCategories.findIndex(
              (category) => category.id === question.assessment_run_category_id,
            ) >= 0,
        ),
      }),
      expectedRespondentsCount: respondents.length,
      completedRespondentsCount: respondents.filter((respondent) => respondent.responded_at)
        .length,
      isRespondent: Boolean(myRespondent),
      myRespondedAt: myRespondent?.responded_at ?? null,
      myAnswers: answers
        .filter((answer) => answer.respondent_profile_id === input.currentProfileId)
        .map((answer) => ({
          questionId: answer.assessment_run_question_id,
          scaleOptionId: answer.assessment_run_scale_option_id,
        })),
      allAnswers: answers.map((answer) => ({
        questionId: answer.assessment_run_question_id,
        scaleOptionId: answer.assessment_run_scale_option_id,
        respondentProfileId: answer.respondent_profile_id,
      })),
    }
  })
}

async function loadTeamVenueContext(input: {
  activeTeamId: string
  supabase: ServerSupabaseClient
}): Promise<TeamVenueContext> {
  const { data: teamVenueData, error: teamVenueError } = await input.supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)

  if (teamVenueError) {
    throw new Error(`Could not load team venues for assessments: ${teamVenueError.message}`)
  }

  const teamVenueRows = (teamVenueData ?? []) as TeamVenueRow[]
  const teamVenueIds = teamVenueRows.map((row) => row.id)
  const venueIds = uniqueIds(teamVenueRows.map((row) => row.venue_id))

  let venueRows: VenueRow[] = []
  let campRows: CampRow[] = []

  if (venueIds.length > 0) {
    const { data: venueData, error: venueError } = await input.supabase
      .from("venues")
      .select(VENUE_SELECT_COLUMNS)
      .in("id", venueIds)
      .order("name", { ascending: true })

    if (venueError) {
      throw new Error(`Could not load venues for assessments: ${venueError.message}`)
    }

    venueRows = (venueData ?? []) as VenueRow[]
  }

  if (teamVenueIds.length > 0) {
    const { data: campData, error: campError } = await input.supabase
      .from("camps")
      .select(CAMP_SELECT_COLUMNS)
      .in("team_venue_id", teamVenueIds)
      .order("start_date", { ascending: false })

    if (campError) {
      throw new Error(`Could not load camps for assessments: ${campError.message}`)
    }

    campRows = (campData ?? []) as CampRow[]
  }

  const venueById = new Map(venueRows.map((row) => [row.id, row]))
  const teamVenueById = new Map(teamVenueRows.map((row) => [row.id, row]))
  const campById = new Map(campRows.map((row) => [row.id, row]))

  const venueOptions: TeamAssessmentVenueOption[] = teamVenueRows
    .map((teamVenue) => {
      const venue = venueById.get(teamVenue.venue_id)

      if (!venue) {
        return null
      }

      return {
        teamVenueId: teamVenue.id,
        venueId: venue.id,
        venueName: venue.name,
        venueLocation: buildLocation(venue),
      }
    })
    .filter((row): row is TeamAssessmentVenueOption => row !== null)
    .sort((left, right) => left.venueName.localeCompare(right.venueName))

  const campOptions: TeamAssessmentCampOption[] = campRows
    .map((camp) => ({
      campId: camp.id,
      teamVenueId: camp.team_venue_id,
      campName: camp.name,
      startDate: camp.start_date,
      endDate: camp.end_date,
      isActive: camp.is_active,
      dateRangeLabel: buildDateRangeLabel({
        startDate: camp.start_date,
        endDate: camp.end_date,
      }),
    }))
    .sort((left, right) => {
      const venueCompare =
        venueOptions
          .find((option) => option.teamVenueId === left.teamVenueId)
          ?.venueName.localeCompare(
            venueOptions.find((option) => option.teamVenueId === right.teamVenueId)
              ?.venueName ?? "",
          ) ?? 0

      if (venueCompare !== 0) {
        return venueCompare
      }

      return right.startDate.localeCompare(left.startDate)
    })

  return {
    venueOptions,
    campOptions,
    teamVenueRows,
    teamVenueById,
    venueById,
    campById,
  }
}

async function loadTeamAssessmentTemplates(input: {
  activeTeamId: string
  includeInactive?: boolean
  supabase: ServerSupabaseClient
}): Promise<TeamAssessmentTemplate[]> {
  let query = input.supabase
    .from("assessment_templates")
    .select(ASSESSMENT_TEMPLATE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)
    .order("updated_at", { ascending: false })

  if (!input.includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data: templateData, error: templateError } = await query

  if (templateError) {
    throw new Error(`Could not load assessment templates: ${templateError.message}`)
  }

  const templates = (templateData ?? []) as AssessmentTemplateRow[]
  const templateIds = templates.map((template) => template.id)

  if (templateIds.length === 0) {
    return []
  }

  const [
    { data: scaleOptionData, error: scaleOptionError },
    { data: categoryData, error: categoryError },
  ] = await Promise.all([
    input.supabase
      .from("assessment_template_scale_options")
      .select(ASSESSMENT_TEMPLATE_SCALE_OPTION_SELECT_COLUMNS)
      .in("assessment_template_id", templateIds),
    input.supabase
      .from("assessment_template_categories")
      .select(ASSESSMENT_TEMPLATE_CATEGORY_SELECT_COLUMNS)
      .in("assessment_template_id", templateIds),
  ])

  if (scaleOptionError) {
    throw new Error(
      `Could not load assessment template scale options: ${scaleOptionError.message}`,
    )
  }

  if (categoryError) {
    throw new Error(`Could not load assessment template categories: ${categoryError.message}`)
  }

  const categories = (categoryData ?? []) as AssessmentTemplateCategoryRow[]
  const categoryIds = categories.map((category) => category.id)
  let modes: AssessmentTemplateModeRow[] = []
  let questions: AssessmentTemplateQuestionRow[] = []

  if (categoryIds.length > 0) {
    const [
      { data: modeData, error: modeError },
      { data: questionData, error: questionError },
    ] = await Promise.all([
      input.supabase
        .from("assessment_template_modes")
        .select(ASSESSMENT_TEMPLATE_MODE_SELECT_COLUMNS)
        .in("assessment_template_category_id", categoryIds),
      input.supabase
        .from("assessment_template_questions")
        .select(ASSESSMENT_TEMPLATE_QUESTION_SELECT_COLUMNS)
        .in("assessment_template_category_id", categoryIds),
    ])

    if (modeError) {
      throw new Error(`Could not load assessment template modes: ${modeError.message}`)
    }

    if (questionError) {
      throw new Error(`Could not load assessment template questions: ${questionError.message}`)
    }

    modes = (modeData ?? []) as AssessmentTemplateModeRow[]
    questions = (questionData ?? []) as AssessmentTemplateQuestionRow[]
  }

  return buildTemplates({
    templates,
    templateScaleOptions: (scaleOptionData ?? []) as AssessmentTemplateScaleOptionRow[],
    templateCategories: categories,
    templateModes: modes,
    templateQuestions: questions,
  })
}

async function loadTeamAssessmentTemplateOptions(input: {
  activeTeamId: string
  supabase: ServerSupabaseClient
}): Promise<TeamAssessmentTemplateOption[]> {
  const { data, error } = await input.supabase
    .from("assessment_templates")
    .select("id,name")
    .eq("team_id", input.activeTeamId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })

  if (error) {
    throw new Error(`Could not load assessment template options: ${error.message}`)
  }

  return (data ?? []).map((template) => ({
    id: template.id,
    name: template.name,
  }))
}

async function loadRunsByIds(input: {
  runIds: string[]
  runs: AssessmentRunRow[]
  context: TeamVenueContext
  currentProfileId: string
  templateNameById: Map<string, string>
  supabase: ServerSupabaseClient
}): Promise<TeamAssessmentRun[]> {
  if (input.runIds.length === 0) {
    return []
  }

  const [
    { data: scaleOptionData, error: scaleOptionError },
    { data: categoryData, error: categoryError },
    { data: runCampData, error: runCampError },
    { data: respondentData, error: respondentError },
    { data: answerData, error: answerError },
  ] = await Promise.all([
    input.supabase
      .from("assessment_run_scale_options")
      .select(ASSESSMENT_RUN_SCALE_OPTION_SELECT_COLUMNS)
      .in("assessment_run_id", input.runIds),
    input.supabase
      .from("assessment_run_categories")
      .select(ASSESSMENT_RUN_CATEGORY_SELECT_COLUMNS)
      .in("assessment_run_id", input.runIds),
    input.supabase
      .from("assessment_run_camps")
      .select(ASSESSMENT_RUN_CAMP_SELECT_COLUMNS)
      .in("assessment_run_id", input.runIds),
    input.supabase
      .from("assessment_run_respondents")
      .select(ASSESSMENT_RUN_RESPONDENT_SELECT_COLUMNS)
      .in("assessment_run_id", input.runIds),
    input.supabase
      .from("assessment_run_answers")
      .select(ASSESSMENT_RUN_ANSWER_SELECT_COLUMNS)
      .in("assessment_run_id", input.runIds),
  ])

  if (scaleOptionError) {
    throw new Error(`Could not load assessment run scale options: ${scaleOptionError.message}`)
  }

  if (categoryError) {
    throw new Error(`Could not load assessment run categories: ${categoryError.message}`)
  }

  if (runCampError) {
    throw new Error(`Could not load assessment run camps: ${runCampError.message}`)
  }

  if (respondentError) {
    throw new Error(`Could not load assessment run respondents: ${respondentError.message}`)
  }

  if (answerError) {
    throw new Error(`Could not load assessment run answers: ${answerError.message}`)
  }

  const categories = (categoryData ?? []) as AssessmentRunCategoryRow[]
  const categoryIds = categories.map((category) => category.id)
  let modes: AssessmentRunModeRow[] = []
  let questions: AssessmentRunQuestionRow[] = []

  if (categoryIds.length > 0) {
    const [
      { data: modeData, error: modeError },
      { data: questionData, error: questionError },
    ] = await Promise.all([
      input.supabase
        .from("assessment_run_modes")
        .select(ASSESSMENT_RUN_MODE_SELECT_COLUMNS)
        .in("assessment_run_category_id", categoryIds),
      input.supabase
        .from("assessment_run_questions")
        .select(ASSESSMENT_RUN_QUESTION_SELECT_COLUMNS)
        .in("assessment_run_category_id", categoryIds),
    ])

    if (modeError) {
      throw new Error(`Could not load assessment run modes: ${modeError.message}`)
    }

    if (questionError) {
      throw new Error(`Could not load assessment run questions: ${questionError.message}`)
    }

    modes = (modeData ?? []) as AssessmentRunModeRow[]
    questions = (questionData ?? []) as AssessmentRunQuestionRow[]
  }

  return buildRuns({
    runs: input.runs,
    runScaleOptions: (scaleOptionData ?? []) as AssessmentRunScaleOptionRow[],
    runCategories: categories,
    runModes: modes,
    runQuestions: questions,
    runCamps: (runCampData ?? []) as AssessmentRunCampRow[],
    runRespondents: (respondentData ?? []) as AssessmentRunRespondentRow[],
    runAnswers: (answerData ?? []) as AssessmentRunAnswerRow[],
    campById: input.context.campById,
    teamVenueById: input.context.teamVenueById,
    venueById: input.context.venueById,
    templateNameById: input.templateNameById,
    currentProfileId: input.currentProfileId,
  })
}

function getScaleScore(input: {
  scaleOptions: TeamAssessmentScaleOption[]
  scaleOptionId: string
}): number | null {
  const option = input.scaleOptions.find(
    (scaleOption) => scaleOption.id === input.scaleOptionId,
  )

  if (!option) {
    return null
  }

  const numericLabel = Number.parseFloat(option.label)
  return Number.isFinite(numericLabel) ? numericLabel : option.position
}

function getRunAverage(run: TeamAssessmentRun): number | null {
  const scores = run.allAnswers
    .map((answer) =>
      getScaleScore({
        scaleOptions: run.scaleOptions,
        scaleOptionId: answer.scaleOptionId,
      }),
    )
    .filter((score): score is number => score !== null)

  if (scores.length === 0) {
    return null
  }

  return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
}

function getQuestionsForRun(run: TeamAssessmentRun): Array<{
  questionId: string
  categoryName: string
  modeName: string | null
  prompt: string
}> {
  const questions: Array<{
    questionId: string
    categoryName: string
    modeName: string | null
    prompt: string
  }> = []

  for (const category of run.categories) {
    for (const question of category.questions) {
      questions.push({
        questionId: question.id,
        categoryName: category.name,
        modeName: null,
        prompt: question.prompt,
      })
    }

    for (const mode of category.modes ?? []) {
      for (const question of mode.questions) {
        questions.push({
          questionId: question.id,
          categoryName: category.name,
          modeName: mode.name,
          prompt: question.prompt,
        })
      }
    }
  }

  return questions
}

function getRunCategoryAverage(input: {
  run: TeamAssessmentRun
  categoryName: string
}): number | null {
  const questionIds = new Set(
    getQuestionsForRun(input.run)
      .filter((question) => question.categoryName === input.categoryName)
      .map((question) => question.questionId),
  )
  const scores = input.run.allAnswers
    .filter((answer) => questionIds.has(answer.questionId))
    .map((answer) =>
      getScaleScore({
        scaleOptions: input.run.scaleOptions,
        scaleOptionId: answer.scaleOptionId,
      }),
    )
    .filter((score): score is number => score !== null)

  if (scores.length === 0) {
    return null
  }

  return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
}

function averageNumbers(values: Array<number | null>): number | null {
  const safeValues = values.filter((value): value is number => value !== null)

  if (safeValues.length === 0) {
    return null
  }

  return Number(
    (safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length).toFixed(2),
  )
}

function buildDetailSummaries(input: {
  run: TeamAssessmentRun
  comparisonRuns: TeamAssessmentRun[]
}): Omit<TeamAssessmentDetailData, "run" | "comparisonRuns"> {
  const questionMetadata = getQuestionsForRun(input.run)
  const progressPoints = input.comparisonRuns.map((run, index) => ({
    runId: run.id,
    label: `#${index + 1}`,
    average: getRunAverage(run),
    isCurrent: run.id === input.run.id,
  }))
  const categoryProgress = input.run.categories.map((category) => {
    const currentAverage = getRunCategoryAverage({
      run: input.run,
      categoryName: category.name,
    })
    const historicalAverage = averageNumbers(
      input.comparisonRuns
        .filter((run) => run.id !== input.run.id)
        .map((run) =>
          getRunCategoryAverage({
            run,
            categoryName: category.name,
          }),
        ),
    )

    return {
      categoryName: category.name,
      currentAverage,
      historicalAverage,
      delta:
        currentAverage !== null && historicalAverage !== null
          ? Number((currentAverage - historicalAverage).toFixed(2))
          : null,
    }
  })
  const questionSummaries = questionMetadata.map((question) => {
    const scores = input.run.allAnswers
      .filter((answer) => answer.questionId === question.questionId)
      .map((answer) =>
        getScaleScore({
          scaleOptions: input.run.scaleOptions,
          scaleOptionId: answer.scaleOptionId,
        }),
      )
      .filter((score): score is number => score !== null)

    return {
      questionId: question.questionId,
      categoryName: question.categoryName,
      modeName: question.modeName,
      prompt: question.prompt,
      average:
        scores.length > 0
          ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
          : null,
      answerCount: scores.length,
    }
  })

  return {
    progressPoints,
    categoryProgress,
    questionSummaries,
  }
}

export async function getTeamAssessmentsCreatedTabData(input: {
  activeTeamId: string
  currentProfileId: string
  page: number
  accumulatePages: boolean
}): Promise<TeamAssessmentsCreatedTabData> {
  const supabase = await createServerSupabaseClient()
  const requestedPage = input.page
  const accumulatePages = input.accumulatePages
  const contextPromise = (async (): Promise<TeamVenueContext> => {
    const contextStartedAt = startTeamAssessmentsListTiming()

    try {
      const context = await loadTeamVenueContext({
        activeTeamId: input.activeTeamId,
        supabase,
      })
      logTeamAssessmentsListTiming({
        phase: "context",
        startedAt: contextStartedAt,
        activeTeamId: input.activeTeamId,
        status: "success",
        metadata: {
          requestedPage,
          accumulatePages,
          teamVenueCount: context.teamVenueRows.length,
          venueOptionCount: context.venueOptions.length,
          campOptionCount: context.campOptions.length,
        },
      })

      return context
    } catch (error) {
      logTeamAssessmentsListTiming({
        phase: "context",
        startedAt: contextStartedAt,
        activeTeamId: input.activeTeamId,
        status: "error",
        error: formatTeamAssessmentsListTimingError(error),
        metadata: {
          requestedPage,
          accumulatePages,
        },
      })
      throw error
    }
  })()
  const templateOptionsPromise = (async (): Promise<TeamAssessmentTemplateOption[]> => {
    const templatesStartedAt = startTeamAssessmentsListTiming()

    try {
      const templateOptions = await loadTeamAssessmentTemplateOptions({
        activeTeamId: input.activeTeamId,
        supabase,
      })
      logTeamAssessmentsListTiming({
        phase: "templates",
        startedAt: templatesStartedAt,
        activeTeamId: input.activeTeamId,
        status: "success",
        metadata: {
          requestedPage,
          accumulatePages,
          templateOptionCount: templateOptions.length,
          definitionLoaded: false,
        },
      })

      return templateOptions
    } catch (error) {
      logTeamAssessmentsListTiming({
        phase: "templates",
        startedAt: templatesStartedAt,
        activeTeamId: input.activeTeamId,
        status: "error",
        error: formatTeamAssessmentsListTimingError(error),
        metadata: {
          requestedPage,
          accumulatePages,
        },
      })
      throw error
    }
  })()
  const countPromise = (async (): Promise<number> => {
    const countStartedAt = startTeamAssessmentsListTiming()
    const { count, error: countError } = await supabase
      .from("assessment_runs")
      .select("id", { count: "exact", head: true })
      .eq("team_id", input.activeTeamId)

    if (countError) {
      logTeamAssessmentsListTiming({
        phase: "count",
        startedAt: countStartedAt,
        activeTeamId: input.activeTeamId,
        status: "error",
        error: countError.message,
        metadata: {
          requestedPage,
          accumulatePages,
        },
      })
      throw new Error(`Could not count assessment runs: ${countError.message}`)
    }

    logTeamAssessmentsListTiming({
      phase: "count",
      startedAt: countStartedAt,
      activeTeamId: input.activeTeamId,
      status: "success",
      metadata: {
        requestedPage,
        accumulatePages,
        totalItems: count ?? 0,
      },
    })

    return count ?? 0
  })()
  const [context, templateOptions, totalRunCount] = await Promise.all([
    contextPromise,
    templateOptionsPromise,
    countPromise,
  ])

  const pagination = resolveAssessmentPagination({
    requestedPage,
    totalItems: totalRunCount,
    accumulatePages,
    pageSize: TEAM_ASSESSMENTS_PAGE_SIZE,
  })
  const from = accumulatePages
    ? 0
    : (pagination.currentPage - 1) * TEAM_ASSESSMENTS_PAGE_SIZE
  const to = accumulatePages
    ? pagination.currentPage * TEAM_ASSESSMENTS_PAGE_SIZE - 1
    : from + TEAM_ASSESSMENTS_PAGE_SIZE - 1
  const runsStartedAt = startTeamAssessmentsListTiming()
  const { data: runData, error: runError } = await supabase
    .from("assessment_runs")
    .select(ASSESSMENT_RUN_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)
    .order("created_at", { ascending: false })
    .range(from, to)

  if (runError) {
    logTeamAssessmentsListTiming({
      phase: "runs",
      startedAt: runsStartedAt,
      activeTeamId: input.activeTeamId,
      status: "error",
      error: runError.message,
      metadata: {
        requestedPage,
        accumulatePages,
        totalItems: totalRunCount,
        currentPage: pagination.currentPage,
        pageCount: pagination.pageCount,
        rangeStart: from,
        rangeEnd: to,
      },
    })
    throw new Error(`Could not load assessment runs: ${runError.message}`)
  }

  const runs = (runData ?? []) as AssessmentRunRow[]
  logTeamAssessmentsListTiming({
    phase: "runs",
    startedAt: runsStartedAt,
    activeTeamId: input.activeTeamId,
    status: "success",
    metadata: {
      requestedPage,
      accumulatePages,
      totalItems: totalRunCount,
      returnedItems: runs.length,
      currentPage: pagination.currentPage,
      pageCount: pagination.pageCount,
      rangeStart: from,
      rangeEnd: to,
    },
  })
  const templateNameById = new Map(
    templateOptions.map((template) => [template.id, template.name]),
  )
  const hydrationStartedAt = startTeamAssessmentsListTiming()
  let hydratedRuns: TeamAssessmentRun[]

  try {
    hydratedRuns = await loadRunsByIds({
      runIds: runs.map((run) => run.id),
      runs,
      context,
      currentProfileId: input.currentProfileId,
      templateNameById,
      supabase,
    })
    logTeamAssessmentsListTiming({
      phase: "hydration",
      startedAt: hydrationStartedAt,
      activeTeamId: input.activeTeamId,
      status: "success",
      metadata: {
        requestedPage,
        accumulatePages,
        runCount: runs.length,
        hydratedRunCount: hydratedRuns.length,
        categoryCount: hydratedRuns.reduce(
          (sum, run) => sum + run.categories.length,
          0,
        ),
        expectedRespondentsCount: hydratedRuns.reduce(
          (sum, run) => sum + run.expectedRespondentsCount,
          0,
        ),
        completedRespondentsCount: hydratedRuns.reduce(
          (sum, run) => sum + run.completedRespondentsCount,
          0,
        ),
        answerCount: hydratedRuns.reduce(
          (sum, run) => sum + run.allAnswers.length,
          0,
        ),
      },
    })
  } catch (error) {
    logTeamAssessmentsListTiming({
      phase: "hydration",
      startedAt: hydrationStartedAt,
      activeTeamId: input.activeTeamId,
      status: "error",
      error: formatTeamAssessmentsListTimingError(error),
      metadata: {
        requestedPage,
        accumulatePages,
        runCount: runs.length,
      },
    })
    throw error
  }

  return {
    venueOptions: context.venueOptions,
    campOptions: context.campOptions,
    templateOptions,
    runs: hydratedRuns,
    pagination,
  }
}

export async function getTeamAssessmentsTemplatesTabData(input: {
  activeTeamId: string
}): Promise<TeamAssessmentsTemplatesTabData> {
  const supabase = await createServerSupabaseClient()
  const templatesStartedAt = startTeamAssessmentsListTiming()

  try {
    const templates = await loadTeamAssessmentTemplates({
      activeTeamId: input.activeTeamId,
      supabase,
    })
    logTeamAssessmentsListTiming({
      phase: "templates",
      startedAt: templatesStartedAt,
      activeTeamId: input.activeTeamId,
      status: "success",
      metadata: {
        templateCount: templates.length,
        definitionLoaded: true,
        scaleOptionCount: templates.reduce(
          (sum, template) => sum + template.scaleOptions.length,
          0,
        ),
        categoryCount: templates.reduce(
          (sum, template) => sum + template.categories.length,
          0,
        ),
        questionCount: templates.reduce(
          (templateSum, template) =>
            templateSum +
            template.categories.reduce(
              (categorySum, category) =>
                categorySum +
                category.questions.length +
                (category.modes ?? []).reduce(
                  (modeSum, mode) => modeSum + mode.questions.length,
                  0,
                ),
              0,
            ),
          0,
        ),
      },
    })

    return {
      templates,
    }
  } catch (error) {
    logTeamAssessmentsListTiming({
      phase: "templates",
      startedAt: templatesStartedAt,
      activeTeamId: input.activeTeamId,
      status: "error",
      error: formatTeamAssessmentsListTimingError(error),
    })
    throw error
  }
}

export async function getTeamAssessmentsPageData(input: {
  activeTeamId: string
  currentProfileId: string
  page: number
  accumulatePages: boolean
}): Promise<TeamAssessmentsPageData> {
  const [createdData, templatesData] = await Promise.all([
    getTeamAssessmentsCreatedTabData(input),
    getTeamAssessmentsTemplatesTabData({
      activeTeamId: input.activeTeamId,
    }),
  ])

  return {
    ...createdData,
    templates: templatesData.templates,
  }
}

export async function getTeamAssessmentDetailData(input: {
  activeTeamId: string
  currentProfileId: string
  assessmentId: string
}): Promise<TeamAssessmentDetailData | null> {
  const supabase = await createServerSupabaseClient()
  const { data: runData, error: runError } = await supabase
    .from("assessment_runs")
    .select(ASSESSMENT_RUN_SELECT_COLUMNS)
    .eq("id", input.assessmentId)
    .eq("team_id", input.activeTeamId)
    .maybeSingle()

  if (runError) {
    throw new Error(`Could not load assessment run: ${runError.message}`)
  }

  if (!runData) {
    return null
  }

  const currentRunRow = runData as AssessmentRunRow
  const [context, templates] = await Promise.all([
    loadTeamVenueContext({
      activeTeamId: input.activeTeamId,
      supabase,
    }),
    loadTeamAssessmentTemplates({
      activeTeamId: input.activeTeamId,
      includeInactive: true,
      supabase,
    }),
  ])
  const templateNameById = new Map(templates.map((template) => [template.id, template.name]))
  let comparisonRows: AssessmentRunRow[] = [currentRunRow]

  if (currentRunRow.assessment_template_id) {
    const { data: comparisonData, error: comparisonError } = await supabase
      .from("assessment_runs")
      .select(ASSESSMENT_RUN_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .eq("assessment_template_id", currentRunRow.assessment_template_id)
      .order("created_at", { ascending: true })
      .limit(DETAIL_COMPARISON_RUN_LIMIT)

    if (comparisonError) {
      throw new Error(
        `Could not load assessment comparison runs: ${comparisonError.message}`,
      )
    }

    comparisonRows = (comparisonData ?? []) as AssessmentRunRow[]

    if (!comparisonRows.some((run) => run.id === currentRunRow.id)) {
      comparisonRows = [...comparisonRows, currentRunRow].sort((left, right) =>
        left.created_at.localeCompare(right.created_at),
      )
    }
  }

  const comparisonRuns = await loadRunsByIds({
    runIds: comparisonRows.map((run) => run.id),
    runs: comparisonRows,
    context,
    currentProfileId: input.currentProfileId,
    templateNameById,
    supabase,
  })
  const run = comparisonRuns.find((comparisonRun) => comparisonRun.id === currentRunRow.id)

  if (!run) {
    return null
  }

  return {
    run,
    comparisonRuns,
    ...buildDetailSummaries({
      run,
      comparisonRuns,
    }),
  }
}
