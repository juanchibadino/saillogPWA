export const NOTIFICATION_EVENT_TYPES: Readonly<{
  CAMP_GOALS_ADDED: "camp_goals_added"
  SESSION_REVIEW_ADDED: "session_review_added"
  SESSION_GOALS_ADDED: "session_goals_added"
  ASSESSMENT_RUN_CREATED: "assessment_run_created"
  GEAR_WARNING: "gear_warning"
  GEAR_CRITICAL: "gear_critical"
}>

export function normalizeNotificationText(value: unknown): string

export function shouldNotifyTextAdded(
  previousValue: unknown,
  nextValue: unknown,
): boolean

export function formatActorName(input?: {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}): string

export function joinCampNames(names?: Array<string | null | undefined>): string

export function buildScopedNotificationHref(input: {
  pathname: string
  orgId?: string | null
  teamId?: string | null
  tab?: string | null
  extraParams?: Record<string, string | null | undefined>
}): string

export function buildUpdateNotificationSettingsHref(input?: {
  orgId?: string | null
  teamId?: string | null
}): string

export function escapeNotificationHtml(value: unknown): string

export function buildUpdateNotificationEmailPayload(input: {
  ctaLabel: string
  heading: string
  message: string
  preferencesUrl?: string | null
  subject: string
  targetHref: string
  targetUrl?: string | null
}): {
  html: string
  subject: string
  text: string
}

export function buildCampGoalsMessage(input: {
  actorName: string
  campName: string
}): string

export function buildSessionUpdateMessage(input: {
  actorName: string
  fieldLabel: string
  sessionLabel: string
}): string

export function buildAssessmentRequestMessage(input: {
  actorName: string
  venueName: string
  campNames: string
}): string

export type AssessmentRunExistingNotificationRow = {
  event_type: string
  metadata: unknown
  recipient_profile_id: string
}

export type AssessmentRunNotificationRow = {
  actor_profile_id: string
  event_type: "assessment_run_created"
  message: string
  metadata: {
    assessmentRunId: string
    campIds: string[]
    teamVenueId: string
  }
  recipient_profile_id: string
  target_href: string
  team_id: string
}

export function buildAssessmentRunTargetHref(input: {
  assessmentRunId: string
  orgId: string
  teamId: string
}): string

export function getExistingAssessmentRunNotificationRecipientIds(input: {
  assessmentRunId: string
  existingRows: AssessmentRunExistingNotificationRow[]
}): Set<string>

export function buildAssessmentRunNotificationRows(input: {
  actorName: string
  actorProfileId: string
  assessmentRunId: string
  campIds: string[]
  campNames: string
  existingRows: AssessmentRunExistingNotificationRow[]
  orgId: string
  recipientProfileIds: string[]
  teamId: string
  teamVenueId: string
  venueName: string
}): AssessmentRunNotificationRow[]

export type AssessmentRunEmailRecipient = {
  email: string
  emailNotificationsEnabled: boolean
  name: string
  profileId: string
}

export function getAssessmentRunEmailRecipients(
  recipients?: AssessmentRunEmailRecipient[],
): AssessmentRunEmailRecipient[]

export function buildAssessmentRunEmailPayload(input: {
  actorName: string
  message: string
  preferencesUrl?: string | null
  targetHref: string
  targetUrl?: string | null
  venueName: string
}): {
  html: string
  subject: string
  text: string
}

export function buildAssessmentRunPushPayload(input: {
  assessmentRunId: string
  message: string
  targetHref: string
}): {
  body: string
  tag: string
  title: string
  url: string
}

export function getNotificationEventTitle(eventType: string): string

export function buildGearAlertMessage(input: {
  gearName: string
  alertState: "warning" | "critical"
}): string

export function buildSessionReviewFieldLabel(input: {
  bestAdded: boolean
  toWorkAdded: boolean
}): string

export function formatSessionLabel(input: {
  sessionDate?: string | null
  dockOutAt?: string | null
}): string

type NotificationStateItem = {
  id: string
  readAt: string | null
}

type NotificationState<T extends NotificationStateItem> = {
  notifications: T[]
  unreadCount: number
}

export function applyNotificationReadState<T extends NotificationStateItem>(
  data: NotificationState<T>,
  id: string,
  readAt: string | null,
): NotificationState<T>

export function applyNotificationDelete<T extends NotificationStateItem>(
  data: NotificationState<T>,
  id: string,
): NotificationState<T>

export function applyNotificationMarkAllRead<T extends NotificationStateItem>(
  data: NotificationState<T>,
  readAt: string,
): NotificationState<T>
