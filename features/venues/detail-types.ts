import type { Database } from "@/types/database";

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
  note: string;
};

export type VenueDetailCampItem = {
  id: string;
  name: string;
  campType: CampRow["camp_type"];
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
  availableYears: number[];
  selectedYear: number;
  byYear: Record<number, VenueDetailYearData>;
};
