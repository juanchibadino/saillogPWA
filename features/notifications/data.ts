import "server-only"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"]

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

  return {
    notifications: (notifications ?? []).map(toNotificationListItem),
    unreadCount: unreadCount ?? 0,
  }
}
