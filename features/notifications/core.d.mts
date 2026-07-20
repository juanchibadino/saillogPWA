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
