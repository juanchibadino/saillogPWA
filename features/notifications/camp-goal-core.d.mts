import type { Json } from "@/types/database"

export type CampGoalCrewMembershipInput = {
  is_active: boolean
  profile_id: string
  role: string
}

export type CampGoalCrewProfileInput = {
  email?: string | null
  email_notifications_enabled?: boolean | null
  first_name?: string | null
  id: string
  is_active: boolean
  last_name?: string | null
}

export type CampGoalCrewRecipient = {
  email: string
  emailNotificationsEnabled: boolean
  name: string
  profileId: string
}

export type CampGoalExistingNotificationRow = {
  event_type: string
  metadata: Json
  recipient_profile_id: string
}

export type CampGoalNotificationRow = {
  actor_profile_id: string
  event_type: "camp_goals_added"
  message: string
  metadata: {
    campId: string
  }
  recipient_profile_id: string
  target_href: string
  team_id: string
}

export function buildProfileDisplayName(profile?: {
  email?: string | null
  first_name?: string | null
  last_name?: string | null
}): string

export function buildCampGoalTargetHref(input: {
  campId: string
  orgId: string
  teamId: string
}): string

export function buildUpdateNotificationSettingsHref(input?: {
  orgId?: string | null
  teamId?: string | null
}): string

export function buildCampGoalCrewRecipients(input: {
  actorProfileId: string
  memberships: CampGoalCrewMembershipInput[]
  profiles: CampGoalCrewProfileInput[]
}): CampGoalCrewRecipient[]

export function getExistingCampGoalNotificationRecipientIds(input: {
  campId: string
  existingRows: CampGoalExistingNotificationRow[]
}): Set<string>

export function buildCampGoalNotificationRows(input: {
  actorName: string
  actorProfileId: string
  campId: string
  campName: string
  existingRows: CampGoalExistingNotificationRow[]
  orgId: string
  recipients: CampGoalCrewRecipient[]
  teamId: string
}): CampGoalNotificationRow[]

export function getCampGoalEmailRecipients(
  recipients?: CampGoalCrewRecipient[],
): CampGoalCrewRecipient[]

export function buildCampGoalEmailPayload(input: {
  actorName: string
  campName: string
  message: string
  preferencesUrl?: string
  targetHref: string
  targetUrl: string
}): {
  html: string
  subject: string
  text: string
}

export function buildCampGoalPushPayload(input: {
  campId: string
  message: string
  targetHref: string
}): {
  body: string
  tag: string
  title: string
  url: string
}
