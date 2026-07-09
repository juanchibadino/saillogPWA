type AssessmentScaleOption = {
  id: string
  label: string
  position: number
}

type AssessmentQuestion = {
  id: string
  prompt: string
  position: number
  isRequired: boolean
}

type AssessmentMode = {
  id: string
  name: string
  position: number
  questions: AssessmentQuestion[]
}

type AssessmentCategory = {
  id: string
  name: string
  position: number
  questions: AssessmentQuestion[]
  modes?: AssessmentMode[]
}

type AssessmentAnswer = {
  questionId: string
  scaleOptionId: string
}

type AssessmentAllAnswer = AssessmentAnswer & {
  respondentProfileId: string
}

type AssessmentRun = {
  id: string
  name: string
  venueName?: string | null
  scaleOptions: AssessmentScaleOption[]
  categories: AssessmentCategory[]
  myAnswers: AssessmentAnswer[]
  allAnswers: AssessmentAllAnswer[]
}

export type TeamAssessmentDetailAnalyticsRespondent = {
  profileId: string
  label: string
  dataKey: string
}

export type TeamAssessmentDetailAnalyticsAnswer = {
  profileId: string
  label: string
  scaleLabel: string
  score: number
}

export type TeamAssessmentDetailAnalyticsMyAnswer = {
  scaleOptionId: string
  scaleLabel: string
  score: number | null
}

export type TeamAssessmentDetailAnalyticsTrendPoint = {
  runId: string
  runName: string
  venueName: string
  label: string
  isCurrent: boolean
  average: number | null
  respondentScores: Record<string, number | null>
}

export type TeamAssessmentDetailAnalyticsItem = {
  questionId: string
  categoryId: string
  categoryName: string
  categoryPosition: number
  modeId: string | null
  modeName: string | null
  modePosition: number | null
  prompt: string
  position: number
  isRequired: boolean
  average: number | null
  answerCount: number
  myAnswer: TeamAssessmentDetailAnalyticsMyAnswer | null
  crewAnswers: TeamAssessmentDetailAnalyticsAnswer[]
  respondentLines: TeamAssessmentDetailAnalyticsRespondent[]
  trendPoints: TeamAssessmentDetailAnalyticsTrendPoint[]
}

export type TeamAssessmentDetailAnalytics = {
  respondentSummaries: TeamAssessmentDetailAnalyticsRespondent[]
  items: TeamAssessmentDetailAnalyticsItem[]
}

export type TeamAssessmentDetailAnalyticsProfile = {
  id?: string
  profileId?: string
  label?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

export function buildTeamAssessmentDetailAnalytics(input: {
  run: AssessmentRun
  comparisonRuns: AssessmentRun[]
  respondentProfiles: TeamAssessmentDetailAnalyticsProfile[]
}): TeamAssessmentDetailAnalytics
