import "server-only";

import {
  getVenueExpensesTabData,
  type TeamExpenseFormOptions,
} from "@/features/expenses/data";
import {
  TEAM_EXPENSE_TYPE_OPTIONS,
  formatCurrencyAmount,
} from "@/features/expenses/shared";
import {
  getVenueDetailTimingErrorMessage,
  logVenueDetailTiming,
  startVenueDetailTiming,
} from "@/features/venues/detail-timing";
import { getTeamVenueWindPatternsPageData } from "@/features/wind-patterns/data";
import {
  TEAM_SESSIONS_PAGE_SIZE,
  type TeamSessionCampOption,
  type TeamSessionHighlightFilter,
  type TeamSessionListItem,
} from "@/features/sessions/data";
import {
  normalizeSelectedId,
  resolveSessionPagination,
} from "@/features/sessions/list-route-state.mjs";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { VenueDetailTab } from "@/features/venues/navigation";
import type {
  VenueAssessmentCategory,
  VenueAssessmentMode,
  VenueAssessmentRun,
  VenueAssessmentRunCamp,
  VenueAssessmentTemplate,
  VenueDetailCampItem,
  VenueDetailChromeData,
  VenueDetailKpisData,
  VenueDetailKpi,
  VenueDetailPageData,
  VenueDetailReportItem,
  VenueDetailSessionItem,
  VenueDetailTabDataByTab,
  VenueDetailTabPayload,
  VenueDetailTeamVenue,
  VenueDetailVenue,
  VenueDetailYearData,
} from "@/features/venues/detail-types";

type CampRow = Pick<
  Database["public"]["Tables"]["camps"]["Row"],
  | "id"
  | "team_venue_id"
  | "name"
  | "camp_type"
  | "start_date"
  | "end_date"
  | "is_active"
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
type SessionYearRow = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "camp_id" | "session_date"
>;
type TeamVenueReportRow = Pick<
  Database["public"]["Tables"]["team_venue_reports"]["Row"],
  "id" | "team_venue_id" | "year" | "name" | "created_at"
>;
type TeamVenueReportCampRow = Pick<
  Database["public"]["Tables"]["team_venue_report_camps"]["Row"],
  "report_id" | "camp_id"
>;
type ExpenseOrganizationRow = Pick<
  Database["public"]["Tables"]["organizations"]["Row"],
  "default_currency_code"
>;
type TeamExpenseSettingsRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "expenses_show_team_totals"
>;
type ExpenseAmountRow = Pick<
  Database["public"]["Tables"]["team_expenses"]["Row"],
  "amount_organization_currency"
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
type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type TeamVenueYearContext = {
  availableYears: number[];
  campIds: string[];
  camps: CampRow[];
  selectedYear: number;
  supabase: ServerSupabaseClient;
};
export type TeamVenueDetailYearContextData = TeamVenueYearContext | null;

const VENUE_SELECT_COLUMNS = "id,organization_id,name,city,country,is_active";
const TEAM_VENUE_SELECT_COLUMNS = "id,team_id,venue_id";
const CAMP_SELECT_COLUMNS =
  "id,team_venue_id,name,camp_type,start_date,end_date,is_active";
const SESSION_SELECT_COLUMNS =
  "id,camp_id,session_type,session_date,net_time_minutes,highlighted_by_coach,created_at";
const SESSION_YEAR_SELECT_COLUMNS = "camp_id,session_date";
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
  sessions: Array<Pick<SessionRow, "session_date">>;
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
    },
    {
      label: "Total Sessions",
      value: String(input.sessionCount),
    },
    {
      label: "Avg. Session",
      value: formatHoursAndMinutes(averageNetTimeMinutes),
    },
    {
      label: "Net Time Sailed",
      value: formatTotalNetTime(totalNetTimeMinutes),
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

function getYearDateRange(year: number): { end: string; start: string } {
  return {
    start: `${year}-01-01`,
    end: `${year + 1}-01-01`,
  };
}

function buildEmptyKpisData(requestedYear?: number): VenueDetailKpisData {
  const currentYear = getCurrentYear();
  const availableYears = [currentYear];
  const selectedYear = resolveSelectedYear({
    availableYears,
    requestedYear,
  });

  return {
    availableYears,
    selectedYear,
    kpis: buildKpis({
      campCount: 0,
      sessionCount: 0,
      sessions: [],
    }),
  };
}

function buildEmptyExpenseFormOptions(): TeamExpenseFormOptions {
  return {
    canAssignMembers: false,
    currencyOptions: ["USD"],
    defaultAssignedToProfileId: "",
    memberOptions: [],
    organizationCurrencyCode: "USD",
    typeOptions: TEAM_EXPENSE_TYPE_OPTIONS,
    venueOptions: [],
  };
}

function buildEmptyTabPayload(tab: VenueDetailTab): VenueDetailTabPayload {
  if (tab === "camps") {
    return {
      camps: [],
    };
  }

  if (tab === "sessions") {
    return {
      campOptions: [],
      currentPage: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      pageCount: 1,
      sessions: [],
    };
  }

  if (tab === "wind-patterns") {
    return {
      windPatterns: buildEmptyWindPatternsData(),
    };
  }

  if (tab === "assessments") {
    return {
      camps: [],
      assessments: {
        templates: [],
        runs: [],
      },
    };
  }

  if (tab === "expenses") {
    return {
      canFilterByMember: false,
      expenses: [],
      formOptions: buildEmptyExpenseFormOptions(),
      memberOptions: [],
      metrics: {
        myTotalLabel: "$0.00",
        myTotalValue: 0,
        teamTotalLabel: null,
        teamTotalValue: null,
      },
      selectedCrewFilter: "you",
      selectedMemberId: undefined,
      selectedVisibilityScope: "mine",
      teamExpensesVisible: false,
    };
  }

  return {
    camps: [],
    reports: [],
  };
}

async function loadTeamVenueYearContext(input: {
  requestedYear?: number;
  teamVenueId: string;
}): Promise<TeamVenueYearContext> {
  const supabase = await createServerSupabaseClient();

  const { data: campRows, error: campsError } = await supabase
    .from("camps")
    .select(CAMP_SELECT_COLUMNS)
    .eq("team_venue_id", input.teamVenueId)
    .order("start_date", { ascending: false })
    .order("name", { ascending: true });

  if (campsError) {
    throw new Error(`Could not load camps: ${campsError.message}`);
  }

  const camps: CampRow[] = campRows ?? [];
  const campIds = camps.map((camp) => camp.id);
  let sessionYearRows: SessionYearRow[] = [];

  if (campIds.length > 0) {
    const { data: sessionRows, error: sessionsError } = await supabase
      .from("sessions")
      .select(SESSION_YEAR_SELECT_COLUMNS)
      .in("camp_id", campIds);

    if (sessionsError) {
      throw new Error(`Could not load session years: ${sessionsError.message}`);
    }

    sessionYearRows = sessionRows ?? [];
  }

  const availableYears = buildAvailableYears({
    camps,
    sessions: sessionYearRows,
    fallbackYear: getCurrentYear(),
  });
  const selectedYear = resolveSelectedYear({
    availableYears,
    requestedYear: input.requestedYear,
  });

  return {
    availableYears,
    campIds,
    camps,
    selectedYear,
    supabase,
  };
}

export async function getTeamVenueDetailYearContextData(input: {
  activeTeamId: string | null;
  requestedYear?: number;
  teamVenue: VenueDetailTeamVenue | null;
}): Promise<TeamVenueDetailYearContextData> {
  if (
    !input.activeTeamId ||
    !input.teamVenue ||
    input.teamVenue.team_id !== input.activeTeamId
  ) {
    return null;
  }

  return loadTeamVenueYearContext({
    requestedYear: input.requestedYear,
    teamVenueId: input.teamVenue.id,
  });
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
    teamVenueId: camp.team_venue_id,
    name: camp.name,
    campType: camp.camp_type,
    startDate: camp.start_date,
    endDate: camp.end_date,
    isActive: camp.is_active,
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

function logTeamVenueTabTiming(input: {
  activeTeamId: string | null;
  data: VenueDetailTabPayload;
  selectedYear: number;
  startedAt: number;
  status: "success";
  tab: VenueDetailTab;
  teamVenueId: string | null;
}): void {
  const baseMetadata = {
    selectedYear: input.selectedYear,
    tab: input.tab,
  };

  if (input.tab === "camps") {
    const data = input.data as VenueDetailTabDataByTab["camps"];

    logVenueDetailTiming({
      route: "/venues/[id]",
      phase: "load_tab",
      startedAt: input.startedAt,
      teamVenueId: input.teamVenueId,
      activeTeamId: input.activeTeamId,
      status: input.status,
      metadata: {
        ...baseMetadata,
        campCount: data.camps.length,
      },
    });
    return;
  }

  if (input.tab === "sessions") {
    const data = input.data as VenueDetailTabDataByTab["sessions"];

    logVenueDetailTiming({
      route: "/venues/[id]",
      phase: "load_tab",
      startedAt: input.startedAt,
      teamVenueId: input.teamVenueId,
      activeTeamId: input.activeTeamId,
      status: input.status,
      metadata: {
        ...baseMetadata,
        currentPage: data.currentPage,
        pageCount: data.pageCount,
        selectedCamp: Boolean(data.selectedCampId),
        selectedHighlight: data.selectedHighlight ?? null,
        sessionCount: data.sessions.length,
      },
    });
    return;
  }

  if (input.tab === "wind-patterns") {
    const data = input.data as VenueDetailTabDataByTab["wind-patterns"];

    logVenueDetailTiming({
      route: "/venues/[id]",
      phase: "load_tab",
      startedAt: input.startedAt,
      teamVenueId: input.teamVenueId,
      activeTeamId: input.activeTeamId,
      status: input.status,
      metadata: {
        ...baseMetadata,
        activeCount: data.windPatterns.activeCount,
        archivedCount: data.windPatterns.archivedCount,
        patternCount: data.windPatterns.patterns.length,
      },
    });
    return;
  }

  if (input.tab === "assessments") {
    const data = input.data as VenueDetailTabDataByTab["assessments"];

    logVenueDetailTiming({
      route: "/venues/[id]",
      phase: "load_tab",
      startedAt: input.startedAt,
      teamVenueId: input.teamVenueId,
      activeTeamId: input.activeTeamId,
      status: input.status,
      metadata: {
        ...baseMetadata,
        campCount: data.camps.length,
        runCount: data.assessments.runs.length,
        templateCount: data.assessments.templates.length,
      },
    });
    return;
  }

  if (input.tab === "expenses") {
    const data = input.data as VenueDetailTabDataByTab["expenses"];

    logVenueDetailTiming({
      route: "/venues/[id]",
      phase: "load_tab",
      startedAt: input.startedAt,
      teamVenueId: input.teamVenueId,
      activeTeamId: input.activeTeamId,
      status: input.status,
      metadata: {
        ...baseMetadata,
        expenseCount: data.expenses.length,
        visibilityScope: data.selectedVisibilityScope,
      },
    });
    return;
  }

  const data = input.data as VenueDetailTabDataByTab["reports"];

  logVenueDetailTiming({
    route: "/venues/[id]",
    phase: "load_tab",
    startedAt: input.startedAt,
    teamVenueId: input.teamVenueId,
    activeTeamId: input.activeTeamId,
    status: input.status,
    metadata: {
      ...baseMetadata,
      campCount: data.camps.length,
      reportCount: data.reports.length,
    },
  });
}

async function loadSelectedYearSessions(input: {
  campIds: string[];
  selectedYear: number;
  supabase: ServerSupabaseClient;
}): Promise<SessionRow[]> {
  if (input.campIds.length === 0) {
    return [];
  }

  const range = getYearDateRange(input.selectedYear);
  const { data: sessionRows, error: sessionsError } = await input.supabase
    .from("sessions")
    .select(SESSION_SELECT_COLUMNS)
    .in("camp_id", input.campIds)
    .gte("session_date", range.start)
    .lt("session_date", range.end)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (sessionsError) {
    throw new Error(`Could not load sessions: ${sessionsError.message}`);
  }

  return sessionRows ?? [];
}

async function loadVenueExpenseKpis(input: {
  activeOrganizationId: string;
  activeTeamId: string;
  currentProfileId: string;
  selectedYear: number;
  supabase: ServerSupabaseClient;
  teamVenueId: string;
}): Promise<VenueDetailKpi[]> {
  const [
    { data: teamRow, error: teamError },
    { data: organizationRow, error: organizationError },
  ] = await Promise.all([
    input.supabase
      .from("teams")
      .select("expenses_show_team_totals")
      .eq("id", input.activeTeamId)
      .eq("organization_id", input.activeOrganizationId)
      .maybeSingle(),
    input.supabase
      .from("organizations")
      .select("default_currency_code")
      .eq("id", input.activeOrganizationId)
      .maybeSingle(),
  ]);

  if (teamError) {
    throw new Error(`Could not load venue expense settings: ${teamError.message}`);
  }

  if (organizationError) {
    throw new Error(
      `Could not load venue expense currency: ${organizationError.message}`,
    );
  }

  const teamExpensesVisible =
    (teamRow as TeamExpenseSettingsRow | null)?.expenses_show_team_totals ?? false;
  const organizationCurrencyCode =
    (organizationRow as ExpenseOrganizationRow | null)?.default_currency_code ?? "USD";
  const myQuery = input.supabase
    .from("team_expenses")
    .select("amount_organization_currency")
    .eq("team_id", input.activeTeamId)
    .eq("team_venue_id", input.teamVenueId)
    .eq("expense_year", input.selectedYear)
    .eq("assigned_to_profile_id", input.currentProfileId);
  const teamQuery = input.supabase
    .from("team_expenses")
    .select("amount_organization_currency")
    .eq("team_id", input.activeTeamId)
    .eq("team_venue_id", input.teamVenueId)
    .eq("expense_year", input.selectedYear);
  const [{ data: myRows, error: myError }, teamResult] = await Promise.all([
    myQuery,
    teamExpensesVisible ? teamQuery : Promise.resolve({ data: [], error: null }),
  ]);

  if (myError) {
    throw new Error(`Could not load venue personal expenses: ${myError.message}`);
  }

  if (teamResult.error) {
    throw new Error(`Could not load venue team expenses: ${teamResult.error.message}`);
  }

  const myTotal = ((myRows ?? []) as ExpenseAmountRow[]).reduce(
    (sum, row) => sum + Number(row.amount_organization_currency),
    0,
  );
  const teamTotal = teamExpensesVisible
    ? ((teamResult.data ?? []) as ExpenseAmountRow[]).reduce(
        (sum, row) => sum + Number(row.amount_organization_currency),
        0,
      )
    : 0;
  const kpis: VenueDetailKpi[] = [];

  if (myTotal > 0) {
    kpis.push({
      label: "My Expenses",
      value: formatCurrencyAmount({
        amount: myTotal,
        currencyCode: organizationCurrencyCode,
      }),
    });
  }

  if (teamExpensesVisible && teamTotal > 0) {
    kpis.push({
      label: "Team Expenses",
      value: formatCurrencyAmount({
        amount: teamTotal,
        currencyCode: organizationCurrencyCode,
      }),
    });
  }

  return kpis;
}

function buildTeamSessionCampOptions(input: {
  camps: CampRow[];
  venue: VenueDetailVenue | null;
}): TeamSessionCampOption[] {
  const venueId = input.venue?.id ?? "";
  const venueName = input.venue?.name ?? "Venue";

  return input.camps.map((camp) => ({
    campId: camp.id,
    venueId,
    venueName,
    campName: camp.name,
    startDate: camp.start_date,
    endDate: camp.end_date,
    isActive: camp.is_active,
    label: `${camp.name} — ${venueName}`,
  }));
}

async function loadSelectedYearTeamSessionsData(input: {
  accumulatePages: boolean;
  camps: CampRow[];
  requestedPage: number;
  selectedCampId?: string;
  selectedHighlight?: TeamSessionHighlightFilter;
  selectedYear: number;
  supabase: ServerSupabaseClient;
  venue: VenueDetailVenue | null;
}): Promise<VenueDetailTabDataByTab["sessions"]> {
  const campOptions = buildTeamSessionCampOptions({
    camps: input.camps,
    venue: input.venue,
  });
  const selectedCampId = normalizeSelectedId({
    selectedId: input.selectedCampId,
    allowedIds: new Set(campOptions.map((camp) => camp.campId)),
  });
  const sessionCampIds = selectedCampId
    ? [selectedCampId]
    : campOptions.map((camp) => camp.campId);

  if (sessionCampIds.length === 0) {
    const pagination = resolveSessionPagination({
      requestedPage: input.requestedPage,
      totalItems: 0,
      accumulatePages: input.accumulatePages,
      pageSize: TEAM_SESSIONS_PAGE_SIZE,
    });

    return {
      campOptions,
      selectedCampId,
      selectedHighlight: input.selectedHighlight,
      sessions: [],
      currentPage: pagination.currentPage,
      pageCount: pagination.pageCount,
      hasPreviousPage: pagination.hasPreviousPage,
      hasNextPage: pagination.hasNextPage,
    };
  }

  const range = getYearDateRange(input.selectedYear);
  let sessionCountQuery = input.supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .in("camp_id", sessionCampIds)
    .gte("session_date", range.start)
    .lt("session_date", range.end);

  if (input.selectedHighlight === "yes") {
    sessionCountQuery = sessionCountQuery.eq("highlighted_by_coach", true);
  }

  if (input.selectedHighlight === "no") {
    sessionCountQuery = sessionCountQuery.eq("highlighted_by_coach", false);
  }

  const { count: sessionCount, error: sessionCountError } = await sessionCountQuery;

  if (sessionCountError) {
    throw new Error(`Could not count sessions: ${sessionCountError.message}`);
  }

  const pagination = resolveSessionPagination({
    requestedPage: input.requestedPage,
    totalItems: sessionCount ?? 0,
    accumulatePages: input.accumulatePages,
    pageSize: TEAM_SESSIONS_PAGE_SIZE,
  });

  if ((sessionCount ?? 0) === 0) {
    return {
      campOptions,
      selectedCampId,
      selectedHighlight: input.selectedHighlight,
      sessions: [],
      currentPage: pagination.currentPage,
      pageCount: pagination.pageCount,
      hasPreviousPage: pagination.hasPreviousPage,
      hasNextPage: pagination.hasNextPage,
    };
  }

  const visibleCount = input.accumulatePages
    ? pagination.currentPage * TEAM_SESSIONS_PAGE_SIZE
    : TEAM_SESSIONS_PAGE_SIZE;
  const rangeStart = input.accumulatePages
    ? 0
    : (pagination.currentPage - 1) * TEAM_SESSIONS_PAGE_SIZE;
  const rangeEnd = rangeStart + visibleCount - 1;
  let sessionQuery = input.supabase
    .from("sessions")
    .select(SESSION_SELECT_COLUMNS)
    .in("camp_id", sessionCampIds)
    .gte("session_date", range.start)
    .lt("session_date", range.end)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (input.selectedHighlight === "yes") {
    sessionQuery = sessionQuery.eq("highlighted_by_coach", true);
  }

  if (input.selectedHighlight === "no") {
    sessionQuery = sessionQuery.eq("highlighted_by_coach", false);
  }

  const { data: sessionRows, error: sessionError } = await sessionQuery.range(
    rangeStart,
    rangeEnd,
  );

  if (sessionError) {
    throw new Error(`Could not load sessions: ${sessionError.message}`);
  }

  const campOptionById = new Map(campOptions.map((camp) => [camp.campId, camp]));
  const venueId = input.venue?.id ?? "";
  const venueName = input.venue?.name ?? "Venue";
  const sessions: TeamSessionListItem[] = (sessionRows ?? [])
    .map((session) => {
      const camp = campOptionById.get(session.camp_id);

      if (!camp) {
        return null;
      }

      return {
        id: session.id,
        campId: camp.campId,
        campName: camp.campName,
        venueId,
        venueName,
        sessionType: session.session_type,
        sessionDate: session.session_date,
        netTimeMinutes: session.net_time_minutes,
        highlightedByCoach: session.highlighted_by_coach,
      };
    })
    .filter((session): session is TeamSessionListItem => session !== null);

  return {
    campOptions,
    selectedCampId,
    selectedHighlight: input.selectedHighlight,
    sessions,
    currentPage: pagination.currentPage,
    pageCount: pagination.pageCount,
    hasPreviousPage: pagination.hasPreviousPage,
    hasNextPage: pagination.hasNextPage,
  };
}

async function loadTeamVenueAssessmentYearData(input: {
  activeTeamId: string;
  campById: Map<string, CampRow>;
  currentProfileId: string;
  selectedYear: number;
  supabase: ServerSupabaseClient;
  teamVenueId: string;
}): Promise<VenueDetailYearData["assessments"]> {
  const startedAt = startVenueDetailTiming();
  const logAssessmentTiming = (
    status: "success" | "error",
    outcome: string,
    error?: string,
    metadata?: Record<string, string | number | boolean | null | undefined>,
  ) => {
    logVenueDetailTiming({
      route: "/venues/[id]",
      phase: "load_assessments",
      startedAt,
      teamVenueId: input.teamVenueId,
      activeTeamId: input.activeTeamId,
      status,
      error,
      metadata: {
        outcome,
        selectedYear: input.selectedYear,
        ...metadata,
      },
    });
  };
  const throwAssessmentTimingError = (outcome: string, message: string): never => {
    logAssessmentTiming("error", outcome, message);
    throw new Error(message);
  };

  const [
    { data: templateRows, error: templatesError },
    { data: runRows, error: runsError },
  ] = await Promise.all([
    input.supabase
      .from("assessment_templates")
      .select(ASSESSMENT_TEMPLATE_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    input.supabase
      .from("assessment_runs")
      .select(ASSESSMENT_RUN_SELECT_COLUMNS)
      .eq("team_id", input.activeTeamId)
      .eq("team_venue_id", input.teamVenueId)
      .order("created_at", { ascending: false }),
  ]);

  if (templatesError) {
    throwAssessmentTimingError(
      "templates_query_error",
      `Could not load assessment templates: ${templatesError.message}`,
    );
  }

  if (runsError) {
    throwAssessmentTimingError(
      "runs_query_error",
      `Could not load assessment runs: ${runsError.message}`,
    );
  }

  const templates = templateRows ?? [];
  const templateIds = templates.map((template) => template.id);
  const runs = runRows ?? [];
  const runIds = runs.map((run) => run.id);

  let templateScaleOptionRows: AssessmentTemplateScaleOptionRow[] = [];
  let templateCategoryRows: AssessmentTemplateCategoryRow[] = [];
  let templateModeRows: AssessmentTemplateModeRow[] = [];
  let templateQuestionRows: AssessmentTemplateQuestionRow[] = [];

  if (templateIds.length > 0) {
    const [
      { data: templateScaleOptionsData, error: templateScaleOptionError },
      { data: templateCategoriesData, error: templateCategoryError },
    ] = await Promise.all([
      input.supabase
        .from("assessment_template_scale_options")
        .select(ASSESSMENT_TEMPLATE_SCALE_OPTION_SELECT_COLUMNS)
        .in("assessment_template_id", templateIds),
      input.supabase
        .from("assessment_template_categories")
        .select(ASSESSMENT_TEMPLATE_CATEGORY_SELECT_COLUMNS)
        .in("assessment_template_id", templateIds),
    ]);

    if (templateScaleOptionError) {
      throwAssessmentTimingError(
        "template_scale_options_query_error",
        `Could not load assessment template scale options: ${templateScaleOptionError.message}`,
      );
    }

    if (templateCategoryError) {
      throwAssessmentTimingError(
        "template_categories_query_error",
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
        input.supabase
          .from("assessment_template_modes")
          .select(ASSESSMENT_TEMPLATE_MODE_SELECT_COLUMNS)
          .in("assessment_template_category_id", templateCategoryIds),
        input.supabase
          .from("assessment_template_questions")
          .select(ASSESSMENT_TEMPLATE_QUESTION_SELECT_COLUMNS)
          .in("assessment_template_category_id", templateCategoryIds),
      ]);

      if (templateModeError) {
        throwAssessmentTimingError(
          "template_modes_query_error",
          `Could not load assessment template modes: ${templateModeError.message}`,
        );
      }

      if (templateQuestionError) {
        throwAssessmentTimingError(
          "template_questions_query_error",
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
      input.supabase
        .from("assessment_run_scale_options")
        .select(ASSESSMENT_RUN_SCALE_OPTION_SELECT_COLUMNS)
        .in("assessment_run_id", runIds),
      input.supabase
        .from("assessment_run_categories")
        .select(ASSESSMENT_RUN_CATEGORY_SELECT_COLUMNS)
        .in("assessment_run_id", runIds),
      input.supabase
        .from("assessment_run_camps")
        .select(ASSESSMENT_RUN_CAMP_SELECT_COLUMNS)
        .in("assessment_run_id", runIds),
      input.supabase
        .from("assessment_run_respondents")
        .select(ASSESSMENT_RUN_RESPONDENT_SELECT_COLUMNS)
        .in("assessment_run_id", runIds),
      input.supabase
        .from("assessment_run_answers")
        .select(ASSESSMENT_RUN_ANSWER_SELECT_COLUMNS)
        .in("assessment_run_id", runIds)
        .eq("respondent_profile_id", input.currentProfileId),
    ]);

    if (runScaleOptionError) {
      throwAssessmentTimingError(
        "run_scale_options_query_error",
        `Could not load assessment run scale options: ${runScaleOptionError.message}`,
      );
    }

    if (runCategoryError) {
      throwAssessmentTimingError(
        "run_categories_query_error",
        `Could not load assessment run categories: ${runCategoryError.message}`,
      );
    }

    if (runCampError) {
      throwAssessmentTimingError(
        "run_camps_query_error",
        `Could not load assessment run camps: ${runCampError.message}`,
      );
    }

    if (runRespondentError) {
      throwAssessmentTimingError(
        "run_respondents_query_error",
        `Could not load assessment run respondents: ${runRespondentError.message}`,
      );
    }

    if (myRunAnswerError) {
      throwAssessmentTimingError(
        "run_answers_query_error",
        `Could not load assessment run answers: ${myRunAnswerError.message}`,
      );
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
        input.supabase
          .from("assessment_run_modes")
          .select(ASSESSMENT_RUN_MODE_SELECT_COLUMNS)
          .in("assessment_run_category_id", runCategoryIds),
        input.supabase
          .from("assessment_run_questions")
          .select(ASSESSMENT_RUN_QUESTION_SELECT_COLUMNS)
          .in("assessment_run_category_id", runCategoryIds),
      ]);

      if (runModeError) {
        throwAssessmentTimingError(
          "run_modes_query_error",
          `Could not load assessment run modes: ${runModeError.message}`,
        );
      }

      if (runQuestionError) {
        throwAssessmentTimingError(
          "run_questions_query_error",
          `Could not load assessment run questions: ${runQuestionError.message}`,
        );
      }

      runModeRows = (runModesData ?? []) as AssessmentRunModeRow[];
      runQuestionRows = (runQuestionsData ?? []) as AssessmentRunQuestionRow[];
    }
  }

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
    campById: input.campById,
    templateNameById,
    currentProfileId: input.currentProfileId,
  });
  const visibleRuns = venueRuns.filter((run) => runVisibleForYear(run, input.selectedYear));

  logAssessmentTiming("success", "loaded", undefined, {
    runCount: visibleRuns.length,
    templateCount: venueTemplates.length,
    totalRunCount: venueRuns.length,
  });

  return {
    templates: venueTemplates,
    runs: visibleRuns,
  };
}

export async function getTeamVenueDetailChromeData(input: {
  activeOrganizationId: string;
  activeTeamId: string | null;
  teamVenueId: string;
}): Promise<VenueDetailChromeData> {
  const startedAt = startVenueDetailTiming();
  const logChromeTiming = (
    status: "success" | "error",
    outcome: string,
    error?: string,
    metadata?: Record<string, string | number | boolean | null | undefined>,
  ) => {
    logVenueDetailTiming({
      route: "/venues/[id]",
      phase: "load_chrome",
      startedAt,
      teamVenueId: input.teamVenueId,
      activeTeamId: input.activeTeamId,
      status,
      error,
      metadata: {
        outcome,
        activeOrganizationId: input.activeOrganizationId,
        ...metadata,
      },
    });
  };
  const throwChromeTimingError = (outcome: string, message: string): never => {
    logChromeTiming("error", outcome, message);
    throw new Error(message);
  };

  const supabase = await createServerSupabaseClient();

  const { data: teamVenue, error: teamVenueError } = await supabase
    .from("team_venues")
    .select(TEAM_VENUE_SELECT_COLUMNS)
    .eq("id", input.teamVenueId)
    .maybeSingle();

  if (teamVenueError) {
    throwChromeTimingError(
      "team_venue_query_error",
      `Could not load team venue: ${teamVenueError.message}`,
    );
  }

  if (!teamVenue) {
    logChromeTiming("success", "team_venue_not_found");
    return {
      venue: null,
      teamVenue: null,
    };
  }

  if (!input.activeTeamId) {
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select(VENUE_SELECT_COLUMNS)
      .eq("id", teamVenue.venue_id)
      .eq("organization_id", input.activeOrganizationId)
      .maybeSingle();

    if (venueError) {
      throwChromeTimingError(
        "venue_query_error",
        `Could not load venue: ${venueError.message}`,
      );
    }

    logChromeTiming("success", "missing_active_team", undefined, {
      venueId: venue?.id ?? null,
    });

    return {
      venue,
      teamVenue: null,
    };
  }

  if (teamVenue.team_id !== input.activeTeamId) {
    logChromeTiming("success", "team_venue_scope_mismatch", undefined, {
      teamId: teamVenue.team_id,
    });
    return {
      venue: null,
      teamVenue: null,
    };
  }

  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select(VENUE_SELECT_COLUMNS)
    .eq("id", teamVenue.venue_id)
    .eq("organization_id", input.activeOrganizationId)
    .maybeSingle();

  if (venueError) {
    throwChromeTimingError(
      "venue_query_error",
      `Could not load venue: ${venueError.message}`,
    );
  }

  if (!venue) {
    logChromeTiming("success", "venue_not_found", undefined, {
      venueId: teamVenue.venue_id,
    });
    return {
      venue: null,
      teamVenue: null,
    };
  }

  logChromeTiming("success", "loaded", undefined, {
    venueId: venue.id,
  });

  return {
    venue,
    teamVenue,
  };
}

export async function getTeamVenueDetailKpisData(input: {
  activeOrganizationId?: string;
  activeTeamId: string | null;
  currentProfileId?: string;
  requestedYear?: number;
  teamVenue: VenueDetailTeamVenue | null;
  yearContextPromise?: Promise<TeamVenueDetailYearContextData>;
}): Promise<VenueDetailKpisData> {
  const startedAt = startVenueDetailTiming();
  const teamVenueId = input.teamVenue?.id ?? null;

  try {
    const yearContext =
      input.yearContextPromise !== undefined
        ? await input.yearContextPromise
        : await getTeamVenueDetailYearContextData({
            activeTeamId: input.activeTeamId,
            requestedYear: input.requestedYear,
            teamVenue: input.teamVenue,
          });
    const activeTeamId = input.activeTeamId;
    const teamVenue = input.teamVenue;

    if (!yearContext || !activeTeamId || !teamVenue) {
      const emptyData = buildEmptyKpisData(input.requestedYear);

      logVenueDetailTiming({
        route: "/venues/[id]",
        phase: "load_kpis",
        startedAt,
        teamVenueId,
        activeTeamId: input.activeTeamId,
        status: "success",
        metadata: {
          outcome: "empty_scope",
          selectedYear: emptyData.selectedYear,
        },
      });

      return emptyData;
    }

    const sessions = await loadSelectedYearSessions({
      campIds: yearContext.campIds,
      selectedYear: yearContext.selectedYear,
      supabase: yearContext.supabase,
    });
    const selectedYearCamps = filterCampsByYear(yearContext.camps, yearContext.selectedYear);
    const baseKpis = buildKpis({
      campCount: selectedYearCamps.length,
      sessionCount: sessions.length,
      sessions,
    });
    const expenseKpis =
      input.activeOrganizationId && input.currentProfileId
        ? await loadVenueExpenseKpis({
            activeOrganizationId: input.activeOrganizationId,
            activeTeamId,
            currentProfileId: input.currentProfileId,
            selectedYear: yearContext.selectedYear,
            supabase: yearContext.supabase,
            teamVenueId: teamVenue.id,
          })
        : [];
    const kpis = [...baseKpis, ...expenseKpis];

    logVenueDetailTiming({
      route: "/venues/[id]",
      phase: "load_kpis",
      startedAt,
      teamVenueId: teamVenue.id,
      activeTeamId,
      status: "success",
      metadata: {
        availableYearCount: yearContext.availableYears.length,
        campCount: selectedYearCamps.length,
        selectedYear: yearContext.selectedYear,
        sessionCount: sessions.length,
      },
    });

    return {
      availableYears: yearContext.availableYears,
      selectedYear: yearContext.selectedYear,
      kpis,
    };
  } catch (error) {
    logVenueDetailTiming({
      route: "/venues/[id]",
      phase: "load_kpis",
      startedAt,
      teamVenueId,
      activeTeamId: input.activeTeamId,
      status: "error",
      error: getVenueDetailTimingErrorMessage(error),
    });

    throw error;
  }
}

export async function getTeamVenueDetailTabData(input: {
  activeOrganizationId: string;
  activeTeamId: string | null;
  accumulatePages?: boolean;
  canManageTeamFinance: boolean;
  canManageTeamSessions: boolean;
  currentProfileId: string;
  requestedPage?: number;
  requestedYear?: number;
  selectedCampId?: string;
  selectedHighlight?: TeamSessionHighlightFilter;
  selectedMemberId?: string;
  tab: VenueDetailTab;
  teamVenue: VenueDetailTeamVenue | null;
  venue?: VenueDetailVenue | null;
  yearContextPromise?: Promise<TeamVenueDetailYearContextData>;
}): Promise<VenueDetailTabPayload> {
  const startedAt = startVenueDetailTiming();
  const teamVenueId = input.teamVenue?.id ?? null;

  try {
    const yearContext =
      input.yearContextPromise !== undefined
        ? await input.yearContextPromise
        : await getTeamVenueDetailYearContextData({
            activeTeamId: input.activeTeamId,
            requestedYear: input.requestedYear,
            teamVenue: input.teamVenue,
          });
    const activeTeamId = input.activeTeamId;
    const teamVenue = input.teamVenue;

    if (!yearContext || !activeTeamId || !teamVenue) {
      const emptyData = buildEmptyTabPayload(input.tab);

      logTeamVenueTabTiming({
        activeTeamId: input.activeTeamId,
        data: emptyData,
        selectedYear: input.requestedYear ?? getCurrentYear(),
        startedAt,
        status: "success",
        tab: input.tab,
        teamVenueId,
      });

      return emptyData;
    }

    const campById = new Map(yearContext.camps.map((camp) => [camp.id, camp]));
    let data: VenueDetailTabPayload;

    if (input.tab === "camps") {
      const sessions = await loadSelectedYearSessions({
        campIds: yearContext.campIds,
        selectedYear: yearContext.selectedYear,
        supabase: yearContext.supabase,
      });

      data = {
        camps: buildYearData({
          year: yearContext.selectedYear,
          camps: yearContext.camps,
          sessions,
          reports: [],
          reportCampLinks: [],
          campById,
          templates: [],
          runs: [],
        }).camps,
      };
    } else if (input.tab === "sessions") {
      data = await loadSelectedYearTeamSessionsData({
        accumulatePages: input.accumulatePages === true,
        camps: yearContext.camps,
        requestedPage: input.requestedPage ?? 1,
        selectedCampId: input.selectedCampId,
        selectedHighlight: input.selectedHighlight,
        selectedYear: yearContext.selectedYear,
        supabase: yearContext.supabase,
        venue: input.venue ?? null,
      });
    } else if (input.tab === "wind-patterns") {
      const windStartedAt = startVenueDetailTiming();
      const windPatterns = await getTeamVenueWindPatternsPageData({
        teamVenueId: teamVenue.id,
      });

      logVenueDetailTiming({
        route: "/venues/[id]",
        phase: "load_wind_patterns",
        startedAt: windStartedAt,
        teamVenueId: teamVenue.id,
        activeTeamId,
        status: "success",
        metadata: {
          activeCount: windPatterns.activeCount,
          archivedCount: windPatterns.archivedCount,
          patternCount: windPatterns.patterns.length,
          selectedYear: yearContext.selectedYear,
        },
      });

      data = {
        windPatterns,
      };
    } else if (input.tab === "assessments") {
      const sessions = await loadSelectedYearSessions({
        campIds: yearContext.campIds,
        selectedYear: yearContext.selectedYear,
        supabase: yearContext.supabase,
      });
      const assessments = await loadTeamVenueAssessmentYearData({
        activeTeamId,
        campById,
        currentProfileId: input.currentProfileId,
        selectedYear: yearContext.selectedYear,
        supabase: yearContext.supabase,
        teamVenueId: teamVenue.id,
      });

      data = {
        camps: buildYearData({
          year: yearContext.selectedYear,
          camps: yearContext.camps,
          sessions,
          reports: [],
          reportCampLinks: [],
          campById,
          templates: [],
          runs: [],
        }).camps,
        assessments,
      };
    } else if (input.tab === "expenses") {
      data = await getVenueExpensesTabData({
        activeOrganizationId: input.activeOrganizationId,
        activeTeamId,
        canManageTeamFinance: input.canManageTeamFinance,
        canManageTeamSessions: input.canManageTeamSessions,
        currentProfileId: input.currentProfileId,
        requestedMemberId: input.selectedMemberId,
        selectedYear: yearContext.selectedYear,
        teamVenueId: teamVenue.id,
      });
    } else {
      const sessions = await loadSelectedYearSessions({
        campIds: yearContext.campIds,
        selectedYear: yearContext.selectedYear,
        supabase: yearContext.supabase,
      });
      const reportsStartedAt = startVenueDetailTiming();
      const { data: reportRows, error: reportsError } = await yearContext.supabase
        .from("team_venue_reports")
        .select(TEAM_VENUE_REPORT_SELECT_COLUMNS)
        .eq("team_venue_id", teamVenue.id)
        .eq("year", yearContext.selectedYear)
        .order("created_at", { ascending: false });

      if (reportsError) {
        logVenueDetailTiming({
          route: "/venues/[id]",
          phase: "load_reports",
          startedAt: reportsStartedAt,
          teamVenueId: teamVenue.id,
          activeTeamId,
          status: "error",
          error: `Could not load team venue reports: ${reportsError.message}`,
          metadata: {
            selectedYear: yearContext.selectedYear,
          },
        });
        throw new Error(`Could not load team venue reports: ${reportsError.message}`);
      }

      const reports = (reportRows ?? []) as TeamVenueReportRow[];
      const reportIds = reports.map((report) => report.id);
      let reportCampLinks: TeamVenueReportCampRow[] = [];

      if (reportIds.length > 0) {
        const { data: reportCampRows, error: reportCampsError } = await yearContext.supabase
          .from("team_venue_report_camps")
          .select(TEAM_VENUE_REPORT_CAMP_SELECT_COLUMNS)
          .in("report_id", reportIds);

        if (reportCampsError) {
          logVenueDetailTiming({
            route: "/venues/[id]",
            phase: "load_reports",
            startedAt: reportsStartedAt,
            teamVenueId: teamVenue.id,
            activeTeamId,
            status: "error",
            error: `Could not load team venue report camps: ${reportCampsError.message}`,
            metadata: {
              reportCount: reports.length,
              selectedYear: yearContext.selectedYear,
            },
          });
          throw new Error(
            `Could not load team venue report camps: ${reportCampsError.message}`,
          );
        }

        reportCampLinks = (reportCampRows ?? []) as TeamVenueReportCampRow[];
      }

      const yearData = buildYearData({
        year: yearContext.selectedYear,
        camps: yearContext.camps,
        sessions,
        reports,
        reportCampLinks,
        campById,
        templates: [],
        runs: [],
      });

      data = {
        camps: yearData.camps,
        reports: yearData.reports,
      };

      logVenueDetailTiming({
        route: "/venues/[id]",
        phase: "load_reports",
        startedAt: reportsStartedAt,
        teamVenueId: teamVenue.id,
        activeTeamId,
        status: "success",
        metadata: {
          reportCampLinkCount: reportCampLinks.length,
          reportCount: reports.length,
          selectedYear: yearContext.selectedYear,
        },
      });
    }

    logTeamVenueTabTiming({
      activeTeamId,
      data,
      selectedYear: yearContext.selectedYear,
      startedAt,
      status: "success",
      tab: input.tab,
      teamVenueId: teamVenue.id,
    });

    return data;
  } catch (error) {
    logVenueDetailTiming({
      route: "/venues/[id]",
      phase: "load_tab",
      startedAt,
      teamVenueId,
      activeTeamId: input.activeTeamId,
      status: "error",
      error: getVenueDetailTimingErrorMessage(error),
      metadata: {
        requestedYear: input.requestedYear ?? null,
        tab: input.tab,
      },
    });

    throw error;
  }
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
