import "server-only";

import { getTeamVenueWindPatternsPageData } from "@/features/wind-patterns/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  VenueAssessmentCategory,
  VenueAssessmentMode,
  VenueAssessmentRun,
  VenueAssessmentRunCamp,
  VenueAssessmentTemplate,
  VenueDetailCampItem,
  VenueDetailKpi,
  VenueDetailPageData,
  VenueDetailReportItem,
  VenueDetailSessionItem,
  VenueDetailTeamVenue,
  VenueDetailVenue,
  VenueDetailYearData,
} from "@/features/venues/detail-types";

type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  "id" | "name" | "camp_type" | "start_date" | "end_date"
>;
type SessionRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  | "id"
  | "camp_id"
  | "session_type"
  | "session_date"
  | "net_time_minutes"
  | "highlighted_by_coach"
  | "created_at"
>;
type TeamVenueReportRow = Pick<
  Database["public"]["Tables"]["team_venue_reports"]["Row"],
  "id" | "team_venue_id" | "year" | "name" | "created_at"
>;
type TeamVenueReportCampRow = Pick<
  Database["public"]["Tables"]["team_venue_report_camps"]["Row"],
  "report_id" | "camp_id"
>;
type AssessmentTemplateRow = Pick<
  Database["public"]["Tables"]["assessment_templates"]["Row"],
  "id" | "team_id" | "name" | "description" | "is_active" | "updated_at"
>;
type AssessmentTemplateScaleOptionRow = Pick<
  Database["public"]["Tables"]["assessment_template_scale_options"]["Row"],
  "id" | "assessment_template_id" | "label" | "position"
>;
type AssessmentTemplateCategoryRow = Pick<
  Database["public"]["Tables"]["assessment_template_categories"]["Row"],
  "id" | "assessment_template_id" | "name" | "position"
>;
type AssessmentTemplateModeRow = Pick<
  Database["public"]["Tables"]["assessment_template_modes"]["Row"],
  "id" | "assessment_template_category_id" | "name" | "position"
>;
type AssessmentTemplateQuestionRow = Pick<
  Database["public"]["Tables"]["assessment_template_questions"]["Row"],
  | "id"
  | "assessment_template_category_id"
  | "assessment_template_mode_id"
  | "prompt"
  | "position"
  | "is_required"
>;
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
>;
type AssessmentRunScaleOptionRow = Pick<
  Database["public"]["Tables"]["assessment_run_scale_options"]["Row"],
  "id" | "assessment_run_id" | "label" | "position"
>;
type AssessmentRunCategoryRow = Pick<
  Database["public"]["Tables"]["assessment_run_categories"]["Row"],
  "id" | "assessment_run_id" | "name" | "position"
>;
type AssessmentRunModeRow = Pick<
  Database["public"]["Tables"]["assessment_run_modes"]["Row"],
  "id" | "assessment_run_category_id" | "name" | "position"
>;
type AssessmentRunQuestionRow = Pick<
  Database["public"]["Tables"]["assessment_run_questions"]["Row"],
  | "id"
  | "assessment_run_category_id"
  | "assessment_run_mode_id"
  | "prompt"
  | "position"
  | "is_required"
>;
type AssessmentRunCampRow = Pick<
  Database["public"]["Tables"]["assessment_run_camps"]["Row"],
  "assessment_run_id" | "camp_id"
>;
type AssessmentRunRespondentRow = Pick<
  Database["public"]["Tables"]["assessment_run_respondents"]["Row"],
  "assessment_run_id" | "profile_id" | "responded_at"
>;
type AssessmentRunAnswerRow = Pick<
  Database["public"]["Tables"]["assessment_run_answers"]["Row"],
  "assessment_run_id" | "assessment_run_question_id" | "assessment_run_scale_option_id"
>;

const VENUE_SELECT_COLUMNS = "id,organization_id,name,city,country,is_active";
const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id";
const CAMP_SELECT_COLUMNS = "id,name,camp_type,start_date,end_date";
const SESSION_SELECT_COLUMNS =
  "id,camp_id,session_type,session_date,net_time_minutes,highlighted_by_coach,created_at";
const ASSESSMENT_TEMPLATE_SELECT_COLUMNS =
  "id,team_id,name,description,is_active,updated_at";
const ASSESSMENT_TEMPLATE_SCALE_OPTION_SELECT_COLUMNS =
  "id,assessment_template_id,label,position";
const ASSESSMENT_TEMPLATE_CATEGORY_SELECT_COLUMNS =
  "id,assessment_template_id,name,position";
const ASSESSMENT_TEMPLATE_MODE_SELECT_COLUMNS =
  "id,assessment_template_category_id,name,position";
const ASSESSMENT_TEMPLATE_QUESTION_SELECT_COLUMNS =
  "id,assessment_template_category_id,assessment_template_mode_id,prompt,position,is_required";
const ASSESSMENT_RUN_SELECT_COLUMNS =
  "id,team_id,team_venue_id,assessment_template_id,name,description,status,published_at,closed_at,created_at";
const ASSESSMENT_RUN_SCALE_OPTION_SELECT_COLUMNS =
  "id,assessment_run_id,label,position";
const ASSESSMENT_RUN_CATEGORY_SELECT_COLUMNS =
  "id,assessment_run_id,name,position";
const ASSESSMENT_RUN_MODE_SELECT_COLUMNS = "id,assessment_run_category_id,name,position";
const ASSESSMENT_RUN_QUESTION_SELECT_COLUMNS =
  "id,assessment_run_category_id,assessment_run_mode_id,prompt,position,is_required";
const ASSESSMENT_RUN_CAMP_SELECT_COLUMNS = "assessment_run_id,camp_id";
const ASSESSMENT_RUN_RESPONDENT_SELECT_COLUMNS =
  "assessment_run_id,profile_id,responded_at";
const ASSESSMENT_RUN_ANSWER_SELECT_COLUMNS =
  "assessment_run_id,assessment_run_question_id,assessment_run_scale_option_id";
const TEAM_VENUE_REPORT_SELECT_COLUMNS = "id,team_venue_id,year,name,created_at";
const TEAM_VENUE_REPORT_CAMP_SELECT_COLUMNS = "report_id,camp_id";

function getCurrentYear(): number {
  return new Date().getUTCFullYear();
}

function parseYear(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDateLabel(value: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return formatter.format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}`;
}

function formatHoursAndMinutes(minutes: number | null): string {
  if (minutes === null || minutes < 0) {
    return "—";
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}h ${String(rest).padStart(2, "0")}m`;
}

function formatTotalNetTime(minutes: number): string {
  if (minutes <= 0) {
    return "00h 00m";
  }

  const totalDays = Math.floor(minutes / (24 * 60));
  const remainingMinutesAfterDays = minutes - totalDays * 24 * 60;
  const hours = Math.floor(remainingMinutesAfterDays / 60);
  const restMinutes = remainingMinutesAfterDays % 60;

  if (totalDays > 0) {
    return `${totalDays}d ${String(hours).padStart(2, "0")}h ${String(restMinutes).padStart(2, "0")}m`;
  }

  return `${String(hours).padStart(2, "0")}h ${String(restMinutes).padStart(2, "0")}m`;
}

function buildAvailableYears(input: {
  camps: CampRow[];
  sessions: SessionRow[];
  fallbackYear: number;
}): number[] {
  const years = new Set<number>();

  for (const camp of input.camps) {
    const year = parseYear(camp.start_date);

    if (year !== null) {
      years.add(year);
    }
  }

  for (const session of input.sessions) {
    const year = parseYear(session.session_date);

    if (year !== null) {
      years.add(year);
    }
  }

  if (years.size === 0) {
    years.add(input.fallbackYear);
  }

  return [...years].sort((a, b) => b - a);
}

function resolveSelectedYear(input: {
  availableYears: number[];
  requestedYear?: number;
}): number {
  if (
    typeof input.requestedYear === "number" &&
    Number.isFinite(input.requestedYear) &&
    input.availableYears.includes(input.requestedYear)
  ) {
    return input.requestedYear;
  }

  return input.availableYears[0] ?? getCurrentYear();
}

function filterCampsByYear(camps: CampRow[], selectedYear: number): CampRow[] {
  return camps.filter((camp) => parseYear(camp.start_date) === selectedYear);
}

function filterSessionsByYear(
  sessions: SessionRow[],
  selectedYear: number,
): SessionRow[] {
  return sessions.filter((session) => parseYear(session.session_date) === selectedYear);
}

function buildKpis(input: {
  campCount: number;
  sessionCount: number;
  sessions: SessionRow[];
}): VenueDetailKpi[] {
  const sessionsWithNetTimeValues = input.sessions
    .map((session) => session.net_time_minutes)
    .filter((minutes): minutes is number => typeof minutes === "number");

  const totalNetTimeMinutes = sessionsWithNetTimeValues.reduce(
    (sum, minutes) => sum + minutes,
    0,
  );

  const averageNetTimeMinutes =
    sessionsWithNetTimeValues.length > 0
      ? Math.round(totalNetTimeMinutes / sessionsWithNetTimeValues.length)
      : null;

  return [
    {
      label: "Total Camps",
      value: String(input.campCount),
      note: "Selected year",
    },
    {
      label: "Total Sessions",
      value: String(input.sessionCount),
      note: "Selected year",
    },
    {
      label: "Avg. Session",
      value: formatHoursAndMinutes(averageNetTimeMinutes),
      note:
        sessionsWithNetTimeValues.length > 0
          ? `${sessionsWithNetTimeValues.length} sessions with net time`
          : "No net time recorded",
    },
    {
      label: "Net Time Sailed",
      value: formatTotalNetTime(totalNetTimeMinutes),
      note: "Sum of net time for selected year",
    },
  ];
}

function titleCaseSessionType(value: SessionRow["session_type"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildEmptyYearData(): VenueDetailYearData {
  return {
    kpis: buildKpis({
      campCount: 0,
      sessionCount: 0,
      sessions: [],
    }),
    camps: [],
    sessions: [],
    reports: [],
    assessments: {
      templates: [],
      runs: [],
    },
  };
}

function buildEmptyWindPatternsData() {
  return {
    patterns: [],
    activeCount: 0,
    archivedCount: 0,
  };
}

function buildReportsForYear(input: {
  year: number;
  reports: TeamVenueReportRow[];
  reportCampLinks: TeamVenueReportCampRow[];
  campById: Map<string, CampRow>;
}): VenueDetailReportItem[] {
  const campIdsByReportId = new Map<string, string[]>();

  for (const link of input.reportCampLinks) {
    const ids = campIdsByReportId.get(link.report_id) ?? [];
    ids.push(link.camp_id);
    campIdsByReportId.set(link.report_id, ids);
  }

  return input.reports
    .filter((report) => report.year === input.year)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((report) => {
      const camps = (campIdsByReportId.get(report.id) ?? [])
        .map((campId) => input.campById.get(campId))
        .filter((camp): camp is CampRow => camp !== undefined)
        .sort((left, right) => {
          const startOrder = left.start_date.localeCompare(right.start_date);

          if (startOrder !== 0) {
            return startOrder;
          }

          return left.name.localeCompare(right.name);
        });

      return {
        id: report.id,
        name: report.name,
        campCount: camps.length,
        campNames: camps.map((camp) => camp.name),
        createdAt: report.created_at,
      };
    });
}

function buildTemplateCategories(input: {
  categories: AssessmentTemplateCategoryRow[];
  modes: AssessmentTemplateModeRow[];
  questions: AssessmentTemplateQuestionRow[];
}): VenueAssessmentCategory[] {
  const questionsByCategoryId = new Map<string, AssessmentTemplateQuestionRow[]>();
  const questionsByModeId = new Map<string, AssessmentTemplateQuestionRow[]>();
  const modesByCategoryId = new Map<string, AssessmentTemplateModeRow[]>();

  for (const question of input.questions) {
    if (question.assessment_template_mode_id) {
      const existingRows = questionsByModeId.get(question.assessment_template_mode_id) ?? [];
      existingRows.push(question);
      questionsByModeId.set(question.assessment_template_mode_id, existingRows);
      continue;
    }

    const existingRows = questionsByCategoryId.get(question.assessment_template_category_id) ?? [];
    existingRows.push(question);
    questionsByCategoryId.set(question.assessment_template_category_id, existingRows);
  }

  for (const mode of input.modes) {
    const existingRows = modesByCategoryId.get(mode.assessment_template_category_id) ?? [];
    existingRows.push(mode);
    modesByCategoryId.set(mode.assessment_template_category_id, existingRows);
  }

  return input.categories
    .sort((left, right) => left.position - right.position)
    .map((category) => {
      const modes: VenueAssessmentMode[] = (modesByCategoryId.get(category.id) ?? [])
        .sort((left, right) => left.position - right.position)
        .map((mode) => ({
          id: mode.id,
          name: mode.name,
          position: mode.position,
          questions: (questionsByModeId.get(mode.id) ?? [])
            .sort((left, right) => left.position - right.position)
            .map((question) => ({
              id: question.id,
              prompt: question.prompt,
              position: question.position,
              isRequired: question.is_required,
            })),
        }));

      return {
        id: category.id,
        name: category.name,
        position: category.position,
        questions: (questionsByCategoryId.get(category.id) ?? [])
          .sort((left, right) => left.position - right.position)
          .map((question) => ({
            id: question.id,
            prompt: question.prompt,
            position: question.position,
            isRequired: question.is_required,
          })),
        modes: modes.length > 0 ? modes : undefined,
      };
    });
}

function buildTemplates(input: {
  templates: AssessmentTemplateRow[];
  templateScaleOptions: AssessmentTemplateScaleOptionRow[];
  templateCategories: AssessmentTemplateCategoryRow[];
  templateModes: AssessmentTemplateModeRow[];
  templateQuestions: AssessmentTemplateQuestionRow[];
}): VenueAssessmentTemplate[] {
  const scaleOptionsByTemplateId = new Map<string, AssessmentTemplateScaleOptionRow[]>();

  for (const scaleOption of input.templateScaleOptions) {
    const existingRows = scaleOptionsByTemplateId.get(scaleOption.assessment_template_id) ?? [];
    existingRows.push(scaleOption);
    scaleOptionsByTemplateId.set(scaleOption.assessment_template_id, existingRows);
  }

  const categoriesByTemplateId = new Map<string, AssessmentTemplateCategoryRow[]>();

  for (const category of input.templateCategories) {
    const existingRows = categoriesByTemplateId.get(category.assessment_template_id) ?? [];
    existingRows.push(category);
    categoriesByTemplateId.set(category.assessment_template_id, existingRows);
  }

  return input.templates
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .map((template) => {
      const templateCategories = categoriesByTemplateId.get(template.id) ?? [];

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        isActive: template.is_active,
        updatedAt: template.updated_at,
        scaleOptions: (scaleOptionsByTemplateId.get(template.id) ?? [])
          .sort((left, right) => left.position - right.position)
          .map((option) => ({
            id: option.id,
            label: option.label,
            position: option.position,
          })),
        categories: buildTemplateCategories({
          categories: templateCategories,
          modes: input.templateModes.filter(
            (mode) =>
              templateCategories.findIndex((category) => category.id === mode.assessment_template_category_id) >=
              0,
          ),
          questions: input.templateQuestions.filter(
            (question) =>
              templateCategories.findIndex(
                (category) => category.id === question.assessment_template_category_id,
              ) >= 0,
          ),
        }),
      };
    });
}

function buildRunCategories(input: {
  categories: AssessmentRunCategoryRow[];
  modes: AssessmentRunModeRow[];
  questions: AssessmentRunQuestionRow[];
}): VenueAssessmentCategory[] {
  const questionsByCategoryId = new Map<string, AssessmentRunQuestionRow[]>();
  const questionsByModeId = new Map<string, AssessmentRunQuestionRow[]>();
  const modesByCategoryId = new Map<string, AssessmentRunModeRow[]>();

  for (const question of input.questions) {
    if (question.assessment_run_mode_id) {
      const existingRows = questionsByModeId.get(question.assessment_run_mode_id) ?? [];
      existingRows.push(question);
      questionsByModeId.set(question.assessment_run_mode_id, existingRows);
      continue;
    }

    const existingRows = questionsByCategoryId.get(question.assessment_run_category_id) ?? [];
    existingRows.push(question);
    questionsByCategoryId.set(question.assessment_run_category_id, existingRows);
  }

  for (const mode of input.modes) {
    const existingRows = modesByCategoryId.get(mode.assessment_run_category_id) ?? [];
    existingRows.push(mode);
    modesByCategoryId.set(mode.assessment_run_category_id, existingRows);
  }

  return input.categories
    .sort((left, right) => left.position - right.position)
    .map((category) => {
      const modes: VenueAssessmentMode[] = (modesByCategoryId.get(category.id) ?? [])
        .sort((left, right) => left.position - right.position)
        .map((mode) => ({
          id: mode.id,
          name: mode.name,
          position: mode.position,
          questions: (questionsByModeId.get(mode.id) ?? [])
            .sort((left, right) => left.position - right.position)
            .map((question) => ({
              id: question.id,
              prompt: question.prompt,
              position: question.position,
              isRequired: question.is_required,
            })),
        }));

      return {
        id: category.id,
        name: category.name,
        position: category.position,
        questions: (questionsByCategoryId.get(category.id) ?? [])
          .sort((left, right) => left.position - right.position)
          .map((question) => ({
            id: question.id,
            prompt: question.prompt,
            position: question.position,
            isRequired: question.is_required,
          })),
        modes: modes.length > 0 ? modes : undefined,
      };
    });
}

function buildRuns(input: {
  runs: AssessmentRunRow[];
  runScaleOptions: AssessmentRunScaleOptionRow[];
  runCategories: AssessmentRunCategoryRow[];
  runModes: AssessmentRunModeRow[];
  runQuestions: AssessmentRunQuestionRow[];
  runCamps: AssessmentRunCampRow[];
  runRespondents: AssessmentRunRespondentRow[];
  myRunAnswers: AssessmentRunAnswerRow[];
  campById: Map<string, CampRow>;
  templateNameById: Map<string, string>;
  currentProfileId: string;
}): VenueAssessmentRun[] {
  const scaleOptionsByRunId = new Map<string, AssessmentRunScaleOptionRow[]>();

  for (const scaleOption of input.runScaleOptions) {
    const existingRows = scaleOptionsByRunId.get(scaleOption.assessment_run_id) ?? [];
    existingRows.push(scaleOption);
    scaleOptionsByRunId.set(scaleOption.assessment_run_id, existingRows);
  }

  const categoriesByRunId = new Map<string, AssessmentRunCategoryRow[]>();

  for (const category of input.runCategories) {
    const existingRows = categoriesByRunId.get(category.assessment_run_id) ?? [];
    existingRows.push(category);
    categoriesByRunId.set(category.assessment_run_id, existingRows);
  }

  const campsByRunId = new Map<string, VenueAssessmentRunCamp[]>();

  for (const runCamp of input.runCamps) {
    const camp = input.campById.get(runCamp.camp_id);

    if (!camp) {
      continue;
    }

    const existingRows = campsByRunId.get(runCamp.assessment_run_id) ?? [];
    existingRows.push({
      id: camp.id,
      name: camp.name,
      startDate: camp.start_date,
      endDate: camp.end_date,
    });
    campsByRunId.set(runCamp.assessment_run_id, existingRows);
  }

  const respondentsByRunId = new Map<string, AssessmentRunRespondentRow[]>();

  for (const respondent of input.runRespondents) {
    const existingRows = respondentsByRunId.get(respondent.assessment_run_id) ?? [];
    existingRows.push(respondent);
    respondentsByRunId.set(respondent.assessment_run_id, existingRows);
  }

  const myAnswersByRunId = new Map<string, AssessmentRunAnswerRow[]>();

  for (const answer of input.myRunAnswers) {
    const existingRows = myAnswersByRunId.get(answer.assessment_run_id) ?? [];
    existingRows.push(answer);
    myAnswersByRunId.set(answer.assessment_run_id, existingRows);
  }

  return input.runs
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((run) => {
      const runCategories = categoriesByRunId.get(run.id) ?? [];
      const runRespondents = respondentsByRunId.get(run.id) ?? [];
      const myRespondent =
        runRespondents.find((respondent) => respondent.profile_id === input.currentProfileId) ??
        null;

      return {
        id: run.id,
        name: run.name,
        description: run.description,
        status: run.status,
        templateId: run.assessment_template_id,
        templateName: run.assessment_template_id
          ? (input.templateNameById.get(run.assessment_template_id) ?? null)
          : null,
        publishedAt: run.published_at,
        closedAt: run.closed_at,
        camps: (campsByRunId.get(run.id) ?? []).sort((left, right) =>
          left.startDate.localeCompare(right.startDate),
        ),
        scaleOptions: (scaleOptionsByRunId.get(run.id) ?? [])
          .sort((left, right) => left.position - right.position)
          .map((option) => ({
            id: option.id,
            label: option.label,
            position: option.position,
          })),
        categories: buildRunCategories({
          categories: runCategories,
          modes: input.runModes.filter(
            (mode) =>
              runCategories.findIndex((category) => category.id === mode.assessment_run_category_id) >=
              0,
          ),
          questions: input.runQuestions.filter(
            (question) =>
              runCategories.findIndex(
                (category) => category.id === question.assessment_run_category_id,
              ) >= 0,
          ),
        }),
        expectedRespondentsCount: runRespondents.length,
        completedRespondentsCount: runRespondents.filter(
          (respondent) => respondent.responded_at !== null,
        ).length,
        isRespondent: myRespondent !== null,
        myRespondedAt: myRespondent?.responded_at ?? null,
        myAnswers: (myAnswersByRunId.get(run.id) ?? []).map((answer) => ({
          questionId: answer.assessment_run_question_id,
          scaleOptionId: answer.assessment_run_scale_option_id,
        })),
      };
    });
}

function runVisibleForYear(run: VenueAssessmentRun, selectedYear: number): boolean {
  if (run.camps.length === 0) {
    return true;
  }

  return run.camps.some((camp) => parseYear(camp.startDate) === selectedYear);
}

function buildYearData(input: {
  year: number;
  camps: CampRow[];
  sessions: SessionRow[];
  reports: TeamVenueReportRow[];
  reportCampLinks: TeamVenueReportCampRow[];
  campById: Map<string, CampRow>;
  templates: VenueAssessmentTemplate[];
  runs: VenueAssessmentRun[];
}): VenueDetailYearData {
  const camps = filterCampsByYear(input.camps, input.year);
  const sessions = filterSessionsByYear(input.sessions, input.year);
  const sessionCountByCampId = new Map<string, number>();

  for (const session of sessions) {
    const currentCount = sessionCountByCampId.get(session.camp_id) ?? 0;
    sessionCountByCampId.set(session.camp_id, currentCount + 1);
  }

  const campItems: VenueDetailCampItem[] = camps.map((camp) => ({
    id: camp.id,
    name: camp.name,
    campType: camp.camp_type,
    dateRangeLabel: formatDateRange(camp.start_date, camp.end_date),
    sessionCount: sessionCountByCampId.get(camp.id) ?? 0,
  }));

  const sessionItems: VenueDetailSessionItem[] = sessions
    .map((session) => {
      const camp = input.campById.get(session.camp_id);

      if (!camp) {
        return null;
      }

      return {
        id: session.id,
        campId: session.camp_id,
        campName: camp.name,
        sessionType: session.session_type,
        sessionTypeLabel: titleCaseSessionType(session.session_type),
        sessionDateLabel: formatDateLabel(session.session_date),
        durationLabel: formatHoursAndMinutes(session.net_time_minutes),
        highlightedByCoach: session.highlighted_by_coach,
      };
    })
    .filter((row): row is VenueDetailSessionItem => row !== null);

  return {
    kpis: buildKpis({
      campCount: camps.length,
      sessionCount: sessions.length,
      sessions,
    }),
    camps: campItems,
    sessions: sessionItems,
    reports: buildReportsForYear({
      year: input.year,
      reports: input.reports,
      reportCampLinks: input.reportCampLinks,
      campById: input.campById,
    }),
    assessments: {
      templates: input.templates,
      runs: input.runs.filter((run) => runVisibleForYear(run, input.year)),
    },
  };
}

function buildEmptyData(input: {
  venue: VenueDetailVenue | null;
  teamVenue: VenueDetailTeamVenue | null;
  requestedYear?: number;
}): VenueDetailPageData {
  const currentYear = getCurrentYear();
  const availableYears = [currentYear];
  const selectedYear = resolveSelectedYear({
    availableYears,
    requestedYear: input.requestedYear,
  });

  return {
    venue: input.venue,
    teamVenue: input.teamVenue,
    windPatterns: buildEmptyWindPatternsData(),
    availableYears,
    selectedYear,
    byYear: {
      [selectedYear]: buildEmptyYearData(),
    },
  };
}

export async function getVenueDetailPageData(input: {
  activeOrganizationId: string;
  activeTeamId: string | null;
  currentProfileId: string;
  teamVenueId: string;
  requestedYear?: number;
}): Promise<VenueDetailPageData> {
  const supabase = await createServerSupabaseClient();

  const { data: teamVenue, error: teamVenueError } = await supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("id", input.teamVenueId)
    .maybeSingle();

  if (teamVenueError) {
    throw new Error(`Could not load team venue: ${teamVenueError.message}`);
  }

  if (!teamVenue) {
    return buildEmptyData({
      venue: null,
      teamVenue: null,
      requestedYear: input.requestedYear,
    });
  }

  if (!input.activeTeamId) {
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select(VENUE_SELECT_COLUMNS)
      .eq("id", teamVenue.venue_id)
      .eq("organization_id", input.activeOrganizationId)
      .maybeSingle();

    if (venueError) {
      throw new Error(`Could not load venue: ${venueError.message}`);
    }

    return buildEmptyData({
      venue,
      teamVenue: null,
      requestedYear: input.requestedYear,
    });
  }

  if (teamVenue.team_id !== input.activeTeamId) {
    return buildEmptyData({
      teamVenue: null,
      venue: null,
      requestedYear: input.requestedYear,
    });
  }

  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select(VENUE_SELECT_COLUMNS)
    .eq("id", teamVenue.venue_id)
    .eq("organization_id", input.activeOrganizationId)
    .maybeSingle();

  if (venueError) {
    throw new Error(`Could not load venue: ${venueError.message}`);
  }

  if (!venue) {
    return buildEmptyData({
      venue: null,
      teamVenue: null,
      requestedYear: input.requestedYear,
    });
  }

  const { data: campRows, error: campsError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .eq("team_venue_id", teamVenue.id)
    .order("start_date", { ascending: false })
    .order("name", { ascending: true });

  if (campsError) {
    throw new Error(`Could not load camps: ${campsError.message}`);
  }

  const camps: CampRow[] = campRows ?? [];
  const campIds = camps.map((camp) => camp.id);
  let sessions: SessionRow[] = [];

  if (campIds.length > 0) {
    const { data: sessionRows, error: sessionsError } = await supabase
      .from("sessions")
      .select(SESSION_SELECT_COLUMNS)
      .in("camp_id", campIds)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (sessionsError) {
      throw new Error(`Could not load sessions: ${sessionsError.message}`);
    }

    sessions = sessionRows ?? [];
  }

  const [
    { data: reportRows, error: reportsError },
    { data: templateRows, error: templatesError },
    { data: runRows, error: runsError },
    windPatterns,
  ] = await Promise.all([
    supabase
      .from("team_venue_reports")
      .select(TEAM_VENUE_REPORT_SELECT_COLUMNS)
      .eq("team_venue_id", teamVenue.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("assessment_templates")
      .select(ASSESSMENT_TEMPLATE_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    supabase
      .from("assessment_runs")
      .select(ASSESSMENT_RUN_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .eq("team_venue_id", teamVenue.id)
      .order("created_at", { ascending: false }),
    getTeamVenueWindPatternsPageData({
      teamVenueId: teamVenue.id,
    }),
  ]);

  if (reportsError) {
    throw new Error(`Could not load team venue reports: ${reportsError.message}`);
  }

  if (templatesError) {
    throw new Error(`Could not load assessment templates: ${templatesError.message}`);
  }

  if (runsError) {
    throw new Error(`Could not load assessment runs: ${runsError.message}`);
  }

  const templates = templateRows ?? [];
  const templateIds = templates.map((template) => template.id);
  const reports = (reportRows ?? []) as TeamVenueReportRow[];
  const reportIds = reports.map((report) => report.id);

  const runs = runRows ?? [];
  const runIds = runs.map((run) => run.id);

  let reportCampLinks: TeamVenueReportCampRow[] = [];

  if (reportIds.length > 0) {
    const { data: reportCampRows, error: reportCampsError } = await supabase
      .from("team_venue_report_camps")
      .select(TEAM_VENUE_REPORT_CAMP_SELECT_COLUMNS)
      .in("report_id", reportIds);

    if (reportCampsError) {
      throw new Error(`Could not load team venue report camps: ${reportCampsError.message}`);
    }

    reportCampLinks = (reportCampRows ?? []) as TeamVenueReportCampRow[];
  }

  let templateScaleOptionRows: AssessmentTemplateScaleOptionRow[] = [];
  let templateCategoryRows: AssessmentTemplateCategoryRow[] = [];
  let templateModeRows: AssessmentTemplateModeRow[] = [];
  let templateQuestionRows: AssessmentTemplateQuestionRow[] = [];

  if (templateIds.length > 0) {
    const [
      { data: templateScaleOptionsData, error: templateScaleOptionError },
      { data: templateCategoriesData, error: templateCategoryError },
    ] = await Promise.all([
      supabase
        .from("assessment_template_scale_options")
        .select(ASSESSMENT_TEMPLATE_SCALE_OPTION_SELECT_COLUMNS)
        .in("assessment_template_id", templateIds),
      supabase
        .from("assessment_template_categories")
        .select(ASSESSMENT_TEMPLATE_CATEGORY_SELECT_COLUMNS)
        .in("assessment_template_id", templateIds),
    ]);

    if (templateScaleOptionError) {
      throw new Error(
        `Could not load assessment template scale options: ${templateScaleOptionError.message}`,
      );
    }

    if (templateCategoryError) {
      throw new Error(
        `Could not load assessment template categories: ${templateCategoryError.message}`,
      );
    }

    templateScaleOptionRows =
      (templateScaleOptionsData ?? []) as AssessmentTemplateScaleOptionRow[];
    templateCategoryRows = (templateCategoriesData ?? []) as AssessmentTemplateCategoryRow[];

    const templateCategoryIds = templateCategoryRows.map((row) => row.id);

    if (templateCategoryIds.length > 0) {
      const [
        { data: templateModesData, error: templateModeError },
        { data: templateQuestionsData, error: templateQuestionError },
      ] = await Promise.all([
        supabase
          .from("assessment_template_modes")
          .select(ASSESSMENT_TEMPLATE_MODE_SELECT_COLUMNS)
          .in("assessment_template_category_id", templateCategoryIds),
        supabase
          .from("assessment_template_questions")
          .select(ASSESSMENT_TEMPLATE_QUESTION_SELECT_COLUMNS)
          .in("assessment_template_category_id", templateCategoryIds),
      ]);

      if (templateModeError) {
        throw new Error(`Could not load assessment template modes: ${templateModeError.message}`);
      }

      if (templateQuestionError) {
        throw new Error(
          `Could not load assessment template questions: ${templateQuestionError.message}`,
        );
      }

      templateModeRows = (templateModesData ?? []) as AssessmentTemplateModeRow[];
      templateQuestionRows =
        (templateQuestionsData ?? []) as AssessmentTemplateQuestionRow[];
    }
  }

  let runScaleOptionRows: AssessmentRunScaleOptionRow[] = [];
  let runCategoryRows: AssessmentRunCategoryRow[] = [];
  let runModeRows: AssessmentRunModeRow[] = [];
  let runQuestionRows: AssessmentRunQuestionRow[] = [];
  let runCampRows: AssessmentRunCampRow[] = [];
  let runRespondentRows: AssessmentRunRespondentRow[] = [];
  let myRunAnswerRows: AssessmentRunAnswerRow[] = [];

  if (runIds.length > 0) {
    const [
      { data: runScaleOptionsData, error: runScaleOptionError },
      { data: runCategoriesData, error: runCategoryError },
      { data: assessmentRunCampsData, error: runCampError },
      { data: assessmentRunRespondentsData, error: runRespondentError },
      { data: assessmentRunAnswersData, error: myRunAnswerError },
    ] = await Promise.all([
      supabase
        .from("assessment_run_scale_options")
        .select(ASSESSMENT_RUN_SCALE_OPTION_SELECT_COLUMNS)
        .in("assessment_run_id", runIds),
      supabase
        .from("assessment_run_categories")
        .select(ASSESSMENT_RUN_CATEGORY_SELECT_COLUMNS)
        .in("assessment_run_id", runIds),
      supabase
        .from("assessment_run_camps")
        .select(ASSESSMENT_RUN_CAMP_SELECT_COLUMNS)
        .in("assessment_run_id", runIds),
      supabase
        .from("assessment_run_respondents")
        .select(ASSESSMENT_RUN_RESPONDENT_SELECT_COLUMNS)
        .in("assessment_run_id", runIds),
      supabase
        .from("assessment_run_answers")
        .select(ASSESSMENT_RUN_ANSWER_SELECT_COLUMNS)
        .in("assessment_run_id", runIds)
        .eq("respondent_profile_id", input.currentProfileId),
    ]);

    if (runScaleOptionError) {
      throw new Error(
        `Could not load assessment run scale options: ${runScaleOptionError.message}`,
      );
    }

    if (runCategoryError) {
      throw new Error(`Could not load assessment run categories: ${runCategoryError.message}`);
    }

    if (runCampError) {
      throw new Error(`Could not load assessment run camps: ${runCampError.message}`);
    }

    if (runRespondentError) {
      throw new Error(
        `Could not load assessment run respondents: ${runRespondentError.message}`,
      );
    }

    if (myRunAnswerError) {
      throw new Error(`Could not load assessment run answers: ${myRunAnswerError.message}`);
    }

    runScaleOptionRows = (runScaleOptionsData ?? []) as AssessmentRunScaleOptionRow[];
    runCategoryRows = (runCategoriesData ?? []) as AssessmentRunCategoryRow[];
    runCampRows = (assessmentRunCampsData ?? []) as AssessmentRunCampRow[];
    runRespondentRows = (assessmentRunRespondentsData ?? []) as AssessmentRunRespondentRow[];
    myRunAnswerRows = (assessmentRunAnswersData ?? []) as AssessmentRunAnswerRow[];

    const runCategoryIds = runCategoryRows.map((row) => row.id);

    if (runCategoryIds.length > 0) {
      const [
        { data: runModesData, error: runModeError },
        { data: runQuestionsData, error: runQuestionError },
      ] = await Promise.all([
        supabase
          .from("assessment_run_modes")
          .select(ASSESSMENT_RUN_MODE_SELECT_COLUMNS)
          .in("assessment_run_category_id", runCategoryIds),
        supabase
          .from("assessment_run_questions")
          .select(ASSESSMENT_RUN_QUESTION_SELECT_COLUMNS)
          .in("assessment_run_category_id", runCategoryIds),
      ]);

      if (runModeError) {
        throw new Error(`Could not load assessment run modes: ${runModeError.message}`);
      }

      if (runQuestionError) {
        throw new Error(`Could not load assessment run questions: ${runQuestionError.message}`);
      }

      runModeRows = (runModesData ?? []) as AssessmentRunModeRow[];
      runQuestionRows = (runQuestionsData ?? []) as AssessmentRunQuestionRow[];
    }
  }

  const availableYears = buildAvailableYears({
    camps,
    sessions,
    fallbackYear: getCurrentYear(),
  });

  const selectedYear = resolveSelectedYear({
    availableYears,
    requestedYear: input.requestedYear,
  });

  const campById = new Map(camps.map((camp) => [camp.id, camp]));
  const venueTemplates = buildTemplates({
    templates,
    templateScaleOptions: templateScaleOptionRows,
    templateCategories: templateCategoryRows,
    templateModes: templateModeRows,
    templateQuestions: templateQuestionRows,
  });

  const templateNameById = new Map(venueTemplates.map((template) => [template.id, template.name]));

  const venueRuns = buildRuns({
    runs: runs as AssessmentRunRow[],
    runScaleOptions: runScaleOptionRows,
    runCategories: runCategoryRows,
    runModes: runModeRows,
    runQuestions: runQuestionRows,
    runCamps: runCampRows,
    runRespondents: runRespondentRows,
    myRunAnswers: myRunAnswerRows,
    campById,
    templateNameById,
    currentProfileId: input.currentProfileId,
  });

  const byYear: Record<number, VenueDetailYearData> = {};

  for (const year of availableYears) {
    byYear[year] = buildYearData({
      year,
      camps,
      sessions,
      reports,
      reportCampLinks,
      campById,
      templates: venueTemplates,
      runs: venueRuns,
    });
  }

  return {
    venue,
    teamVenue,
    windPatterns,
    availableYears,
    selectedYear,
    byYear,
  };
}
