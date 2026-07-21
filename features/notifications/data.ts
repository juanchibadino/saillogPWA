import "server-only"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createGearAlertNotificationsForActiveTeamMembers } from "@/features/notifications/server"
import type { Database } from "@/types/database"

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"]
type TeamGearAlertRow =
  Database["public"]["Functions"]["get_team_gear_alert_rows"]["Returns"][number]
type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export type NotificationListItem = {
  id: string
  eventType: NotificationRow["event_type"]
  message: string
  targetHref: string
  metadata: NotificationRow["metadata"]
  readAt: string | null
  createdAt: string
}

export type NotificationCenterData = {
  notifications: NotificationListItem[]
  unreadCount: number
}

type GetNotificationCenterDataInput = {
  limit?: number
  unreadOnly?: boolean
  currentProfileId?: string
  activeOrgId?: string | null
  activeTeamId?: string | null
}

function toNotificationListItem(row: NotificationRow): NotificationListItem {
  return {
    id: row.id,
    eventType: row.event_type,
    message: row.message,
    targetHref: row.target_href,
    metadata: row.metadata,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

function isGearAlertRow(
  row: TeamGearAlertRow,
): row is TeamGearAlertRow & { alert_state: "warning" | "critical" } {
  return row.alert_state === "warning" || row.alert_state === "critical"
}

async function syncActiveGearAlertNotifications(input: {
  activeOrgId?: string | null
  activeTeamId?: string | null
  supabase: ServerSupabaseClient
}): Promise<void> {
  const activeOrgId = input.activeOrgId
  const activeTeamId = input.activeTeamId

  if (!activeOrgId || !activeTeamId) {
    return
  }

  const { data, error } = await input.supabase.rpc("get_team_gear_alert_rows", {
    p_gear_item_ids: null,
    p_team_id: activeTeamId,
  })

  if (error) {
    throw new Error(`Could not sync gear alerts: ${error.message}`)
  }

  const gearAlerts = (data ?? [])
    .filter(isGearAlertRow)
    .map((row) => ({
      alertState: row.alert_state,
      gearItemId: row.gear_item_id,
      gearName: row.name,
      triggeredAlertCount: Number(row.triggered_alert_count),
      usageCount: Number(row.usage_count),
      usageMinutes: Number(row.usage_minutes),
    }))

  await createGearAlertNotificationsForActiveTeamMembers({
    actorProfileId: null,
    gearAlerts,
    orgId: activeOrgId,
    teamId: activeTeamId,
  })
}

export function getEmptyNotificationCenterData(): NotificationCenterData {
  return {
    notifications: [],
    unreadCount: 0,
  }
}

export async function getNotificationCenterData(
  input: GetNotificationCenterDataInput = {},
): Promise<NotificationCenterData> {
  const context = input.currentProfileId
    ? null
    : await requireAuthenticatedAccessContext()
  const profileId = input.currentProfileId ?? context?.user.id

  if (!profileId) {
    return getEmptyNotificationCenterData()
  }

  const supabase = await createServerSupabaseClient()
  const limit = Math.max(1, Math.min(input.limit ?? 30, 100))

  try {
    await syncActiveGearAlertNotifications({
      activeOrgId: input.activeOrgId,
      activeTeamId: input.activeTeamId,
      supabase,
    })
  } catch (error) {
    console.warn("Failed to sync gear alert notifications", error)
  }

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("recipient_profile_id", profileId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (input.unreadOnly) {
    query = query.is("read_at", null)
  }

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    query,
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_profile_id", profileId)
      .is("deleted_at", null)
      .is("read_at", null),
  ])

  return {
    notifications: (notifications ?? []).map(toNotificationListItem),
    unreadCount: unreadCount ?? 0,
  }
}
