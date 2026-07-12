import "server-only"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import type { Database, Json } from "@/types/database"

type NotificationEventType = Database["public"]["Enums"]["notification_event_type"]

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
