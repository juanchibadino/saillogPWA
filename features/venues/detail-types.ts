import type { Database } from "@/types/database";
import type { TeamVenueWindPatternsPageData } from "@/features/wind-patterns/data";
import type {
  TeamExpenseFormOptions,
  TeamExpenseCrewFilter,
  TeamExpenseListItem,
  TeamExpenseMemberOption,
  TeamExpenseMetrics,
} from "@/features/expenses/data";
import type {
  TeamSessionCampOption,
  TeamSessionHighlightFilter,
  TeamSessionListItem,
} from "@/features/sessions/data";

type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type TeamVenueRow = Database["public"]["Tables"]["team_venues"]["Row"];
type CampRow = Database["public"]["Tables"]["camps"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

export type VenueDetailVenue = Pick<
  VenueRow,
  "id" | "organization_id" | "name" | "city" | "country" | "is_active"
>;

export type VenueDetailTeamVenue = Pick<TeamVenueRow, "id" | "team_id" | "venue_id">;

export type VenueDetailKpi = {
  label: string;
  value: string;
};

export type VenueDetailCampItem = {
  id: string;
  teamVenueId: string;
  name: string;
  campType: CampRow["camp_type"];
  startDate: string;
  endDate: string;
  isActive: boolean;
  dateRangeLabel: string;
  sessionCount: number;
};

export type VenueDetailSessionItem = {
  id: string;
  campId: string;
  campName: string;
  sessionType: SessionRow["session_type"];
  sessionTypeLabel: string;
  sessionDateLabel: string;
  durationLabel: string;
  highlightedByCoach: boolean;
};

export type VenueDetailReportItem = {
  id: string;
  name: string;
  campCount: number;
  campNames: string[];
  createdAt: string;
};

export type VenueAssessmentScaleOption = {
  id: string;
  label: string;
  position: number;
};

export type VenueAssessmentQuestion = {
  id: string;
  prompt: string;
  position: number;
  isRequired: boolean;
};

export type VenueAssessmentMode = {
  id: string;
  name: string;
  position: number;
  questions: VenueAssessmentQuestion[];
};

export type VenueAssessmentCategory = {
  id: string;
  name: string;
  position: number;
  questions: VenueAssessmentQuestion[];
  modes?: VenueAssessmentMode[];
};

export type VenueAssessmentTemplate = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  updatedAt: string;
  scaleOptions: VenueAssessmentScaleOption[];
  categories: VenueAssessmentCategory[];
};

export type VenueAssessmentRunCamp = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type VenueAssessmentRunAnswer = {
  questionId: string;
  scaleOptionId: string;
};

export type VenueAssessmentRun = {
  id: string;
  name: string;
  description: string | null;
  status: Database["public"]["Enums"]["assessment_run_status_type"];
  templateId: string | null;
  templateName: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  camps: VenueAssessmentRunCamp[];
  scaleOptions: VenueAssessmentScaleOption[];
  categories: VenueAssessmentCategory[];
  expectedRespondentsCount: number;
  completedRespondentsCount: number;
  isRespondent: boolean;
  myRespondedAt: string | null;
  myAnswers: VenueAssessmentRunAnswer[];
};

export type VenueDetailAssessmentsYearData = {
  templates: VenueAssessmentTemplate[];
  runs: VenueAssessmentRun[];
};

export type VenueDetailChromeData = {
  venue: VenueDetailVenue | null;
  teamVenue: VenueDetailTeamVenue | null;
};

export type VenueDetailKpisData = {
  availableYears: number[];
  selectedYear: number;
  kpis: VenueDetailKpi[];
};

export type VenueDetailCampsTabData = {
  camps: VenueDetailCampItem[];
};

export type VenueDetailSessionsTabData = {
  campOptions: TeamSessionCampOption[];
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageCount: number;
  selectedCampId?: string;
  selectedHighlight?: TeamSessionHighlightFilter;
  sessions: TeamSessionListItem[];
};

export type VenueDetailAssessmentsTabData = {
  camps: VenueDetailCampItem[];
  assessments: VenueDetailAssessmentsYearData;
};

export type VenueDetailWindPatternsTabData = {
  windPatterns: TeamVenueWindPatternsPageData;
};

export type VenueDetailReportsTabData = {
  camps: VenueDetailCampItem[];
  reports: VenueDetailReportItem[];
};

export type VenueDetailExpensesBlockReason =
  | "plan_limit_reached"
  | "payment_required";

export type VenueDetailExpensesTabData = {
  canFilterByMember: boolean;
  expenses: TeamExpenseListItem[];
  formOptions: TeamExpenseFormOptions;
  memberOptions: TeamExpenseMemberOption[];
  metrics: TeamExpenseMetrics;
  selectedCrewFilter: TeamExpenseCrewFilter;
  selectedMemberId?: string;
  selectedType?: TeamExpenseListItem["expenseType"];
  selectedVisibilityScope: "mine" | "team";
  teamExpensesBlockReason?: VenueDetailExpensesBlockReason | null;
  teamExpensesVisible: boolean;
  typeOptions: Array<{ label: string; value: TeamExpenseListItem["expenseType"] }>;
};

export type VenueDetailTabDataByTab = {
  camps: VenueDetailCampsTabData;
  sessions: VenueDetailSessionsTabData;
  "wind-patterns": VenueDetailWindPatternsTabData;
  assessments: VenueDetailAssessmentsTabData;
  reports: VenueDetailReportsTabData;
  expenses: VenueDetailExpensesTabData;
};

export type VenueDetailTabPayload =
  VenueDetailTabDataByTab[keyof VenueDetailTabDataByTab];

export type VenueDetailYearData = {
  kpis: VenueDetailKpi[];
  camps: VenueDetailCampItem[];
  sessions: VenueDetailSessionItem[];
  reports: VenueDetailReportItem[];
  assessments: VenueDetailAssessmentsYearData;
};

export type VenueDetailPageData = {
  venue: VenueDetailVenue | null;
  teamVenue: VenueDetailTeamVenue | null;
  windPatterns: TeamVenueWindPatternsPageData;
  availableYears: number[];
  selectedYear: number;
  byYear: Record<number, VenueDetailYearData>;
};
