import "server-only"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import {
  buildGearAlertNotificationRowsForRecipients,
  getUniqueTeamRecipientIds,
  isGearAlertNotificationState,
} from "@/features/notifications/gear-alert-core.mjs"
import type { Database, Json } from "@/types/database"

type NotificationEventType = Database["public"]["Enums"]["notification_event_type"]
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"]
type GearAlertNotificationState = "warning" | "critical"

type CreateNotificationsInput = {
  recipientProfileIds: string[]
  actorProfileId: string
  teamId: string
  eventType: NotificationEventType
  message: string
  targetHref: string
  metadata?: Json
}

type CreateTeamNotificationsInput = Omit<
  CreateNotificationsInput,
  "recipientProfileIds"
> & {
  excludeProfileId?: string
}

type CreateGearAlertNotificationsInput = {
  actorProfileId?: string | null
  gearAlerts: Array<{
    alertState: GearAlertNotificationState
    gearItemId: string
    gearName: string
    triggeredAlertCount: number
    usageCount: number
    usageMinutes: number
  }>
  orgId: string
  teamId: string
}

function uniqueRecipientIds(
  recipientProfileIds: string[],
  actorProfileId: string,
): string[] {
  return [
    ...new Set(
      recipientProfileIds.filter(
        (profileId) => profileId.length > 0 && profileId !== actorProfileId,
      ),
    ),
  ]
}

export async function createNotificationsForRecipients(
  input: CreateNotificationsInput,
): Promise<void> {
  const recipientProfileIds = uniqueRecipientIds(
    input.recipientProfileIds,
    input.actorProfileId,
  )

  if (recipientProfileIds.length === 0) {
    return
  }

  try {
    const adminSupabase = createAdminSupabaseClient()
    const { error } = await adminSupabase.from("notifications").insert(
      recipientProfileIds.map((recipientProfileId) => ({
        recipient_profile_id: recipientProfileId,
        actor_profile_id: input.actorProfileId,
        team_id: input.teamId,
        event_type: input.eventType,
        message: input.message,
        target_href: input.targetHref,
        metadata: input.metadata ?? {},
      })),
    )

    if (error) {
      console.error("Failed to create notifications", error)
    }
  } catch (error) {
    console.error("Failed to create notifications", error)
  }
}

export async function createNotificationsForActiveTeamMembers(
  input: CreateTeamNotificationsInput,
): Promise<void> {
  try {
    const adminSupabase = createAdminSupabaseClient()
    const { data, error } = await adminSupabase
      .from("team_memberships")
      .select("profile_id")
      .eq("team_id", input.teamId)
      .eq("is_active", true)

    if (error) {
      console.error("Failed to load notification recipients", error)
      return
    }

    const recipientProfileIds =
      data
        ?.map((membership) => membership.profile_id)
        .filter((profileId) => profileId !== input.excludeProfileId) ?? []

    await createNotificationsForRecipients({
      recipientProfileIds,
      actorProfileId: input.actorProfileId,
      teamId: input.teamId,
      eventType: input.eventType,
      message: input.message,
      targetHref: input.targetHref,
      metadata: input.metadata,
    })
  } catch (error) {
    console.error("Failed to create team notifications", error)
  }
}

export async function createGearAlertNotificationsForActiveTeamMembers(
  input: CreateGearAlertNotificationsInput,
): Promise<void> {
  const alertRows = input.gearAlerts.filter(
    (alert) => isGearAlertNotificationState(alert.alertState),
  )

  if (alertRows.length === 0) {
    return
  }

  try {
    const adminSupabase = createAdminSupabaseClient()
    const { data: memberships, error: membershipsError } = await adminSupabase
      .from("team_memberships")
      .select("profile_id")
      .eq("team_id", input.teamId)
      .eq("is_active", true)

    if (membershipsError) {
      console.warn("Failed to load gear alert notification recipients", membershipsError)
      return
    }

    const recipientProfileIds = getUniqueTeamRecipientIds(
      memberships?.map((membership) => membership.profile_id) ?? [],
    )

    if (recipientProfileIds.length === 0) {
      return
    }

    const { data: existingRows, error: existingRowsError } = await adminSupabase
      .from("notifications")
      .select("recipient_profile_id,event_type,metadata")
      .eq("team_id", input.teamId)
      .in("recipient_profile_id", recipientProfileIds)

    if (existingRowsError) {
      console.warn("Failed to load existing gear alert notifications", existingRowsError)
      return
    }

    const notificationRows: NotificationInsert[] =
      buildGearAlertNotificationRowsForRecipients({
        actorProfileId: input.actorProfileId,
        existingRows: existingRows ?? [],
        gearAlerts: alertRows,
        orgId: input.orgId,
        recipientProfileIds,
        teamId: input.teamId,
      })

    if (notificationRows.length === 0) {
      return
    }

    const { error: insertError } = await adminSupabase
      .from("notifications")
      .insert(notificationRows)

    if (insertError) {
      console.warn("Failed to create gear alert notifications", insertError)
    }
  } catch (error) {
    console.warn("Failed to create gear alert notifications", error)
  }
}
