import "server-only"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  buildGearAlertMessage,
  buildScopedNotificationHref,
  NOTIFICATION_EVENT_TYPES,
} from "@/features/notifications/core.mjs"
import type { Database } from "@/types/database"

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"]
type TeamGearListRow =
  Database["public"]["Functions"]["get_team_gear_list_rows"]["Returns"][number]
type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export type NotificationListItem = {
  id: string
  eventType: NotificationRow["event_type"]
  message: string
  targetHref: string
  metadata: NotificationRow["metadata"]
  readAt: string | null
  createdAt: string
  source: "persisted" | "gear_alert"
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
    source: "persisted",
  }
}

function isGearAlertRow(
  row: TeamGearListRow,
): row is TeamGearListRow & { alert_state: "warning" | "critical" } {
  return row.alert_state === "warning" || row.alert_state === "critical"
}

function mapGearAlertNotification(input: {
  row: TeamGearListRow & { alert_state: "warning" | "critical" }
  activeOrgId: string
  activeTeamId: string
  createdAt: string
}): NotificationListItem {
  const metadata: NotificationRow["metadata"] = {
    alertState: input.row.alert_state,
    gearItemId: input.row.gear_item_id,
    triggeredAlertCount: Number(input.row.triggered_alert_count),
    usageCount: Number(input.row.usage_count),
    usageMinutes: Number(input.row.usage_minutes),
  }

  return {
    id: `gear-alert:${input.activeTeamId}:${input.row.gear_item_id}:${input.row.alert_state}`,
    eventType:
      input.row.alert_state === "critical"
        ? NOTIFICATION_EVENT_TYPES.GEAR_CRITICAL
        : NOTIFICATION_EVENT_TYPES.GEAR_WARNING,
    message: buildGearAlertMessage({
      gearName: input.row.name,
      alertState: input.row.alert_state,
    }),
    targetHref: buildScopedNotificationHref({
      pathname: "/team-gear",
      orgId: input.activeOrgId,
      teamId: input.activeTeamId,
      extraParams: {
        alert: input.row.alert_state,
      },
    }),
    metadata,
    readAt: input.createdAt,
    createdAt: input.createdAt,
    source: "gear_alert",
  }
}

async function getActiveGearAlertNotifications(input: {
  supabase: ServerSupabaseClient
  activeOrgId?: string | null
  activeTeamId?: string | null
}): Promise<NotificationListItem[]> {
  const activeOrgId = input.activeOrgId
  const activeTeamId = input.activeTeamId

  if (!activeOrgId || !activeTeamId) {
    return []
  }

  const baseArgs = {
    p_team_id: activeTeamId,
    p_type: null,
    p_status: null,
    p_condition: null,
    p_limit: 8,
    p_offset: 0,
  }
  const [criticalResult, warningResult] = await Promise.all([
    input.supabase.rpc("get_team_gear_list_rows", {
      ...baseArgs,
      p_alert: "critical",
    }),
    input.supabase.rpc("get_team_gear_list_rows", {
      ...baseArgs,
      p_alert: "warning",
    }),
  ])

  if (criticalResult.error) {
    throw new Error(`Could not load critical gear alerts: ${criticalResult.error.message}`)
  }

  if (warningResult.error) {
    throw new Error(`Could not load warning gear alerts: ${warningResult.error.message}`)
  }

  const createdAt = new Date().toISOString()
  const rows = [...(criticalResult.data ?? []), ...(warningResult.data ?? [])]

  return rows
    .filter(isGearAlertRow)
    .map((row) =>
      mapGearAlertNotification({
        row,
        activeOrgId,
        activeTeamId,
        createdAt,
      }),
    )
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
  let activeGearAlertNotifications: NotificationListItem[] = []

  if (!input.unreadOnly) {
    try {
      activeGearAlertNotifications = await getActiveGearAlertNotifications({
        supabase,
        activeOrgId: input.activeOrgId,
        activeTeamId: input.activeTeamId,
      })
    } catch (error) {
      console.error("Failed to load gear alert notifications", error)
    }
  }

  return {
    notifications: [
      ...activeGearAlertNotifications,
      ...(notifications ?? []).map(toNotificationListItem),
    ].slice(0, limit),
    unreadCount: unreadCount ?? 0,
  }
}
