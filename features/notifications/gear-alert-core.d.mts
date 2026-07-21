export type GearAlertNotificationState = "warning" | "critical"

export type GearAlertNotificationInput = {
  alertState: GearAlertNotificationState
  gearItemId: string
  gearName: string
  triggeredAlertCount: number
  usageCount: number
  usageMinutes: number
}

export type ExistingGearAlertNotificationRow = {
  event_type: string
  metadata: unknown
  recipient_profile_id: string
}

export type GearAlertNotificationInsert = {
  actor_profile_id: string | null
  event_type: "gear_warning" | "gear_critical"
  message: string
  metadata: {
    alertState: GearAlertNotificationState
    gearItemId: string
    triggeredAlertCount: number
    usageCount: number
    usageMinutes: number
  }
  recipient_profile_id: string
  target_href: string
  team_id: string
}

export function isGearAlertNotificationState(
  value: unknown,
): value is GearAlertNotificationState

export function getGearAlertNotificationEventType(
  alertState: GearAlertNotificationState,
): "gear_warning" | "gear_critical"

export function getUniqueTeamRecipientIds(recipientProfileIds: string[]): string[]

export function getExistingGearAlertKey(input: {
  eventType: string
  metadata: unknown
  recipientProfileId: string
}): string | null

export function buildGearAlertNotificationRowsForRecipients(input: {
  actorProfileId?: string | null
  existingRows?: ExistingGearAlertNotificationRow[]
  gearAlerts: GearAlertNotificationInput[]
  orgId: string
  recipientProfileIds: string[]
  teamId: string
}): GearAlertNotificationInsert[]
