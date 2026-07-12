"use server"

import { revalidatePath } from "next/cache"

import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type NotificationActionResult = {
  ok: boolean
}

function revalidateNotificationSurfaces(): void {
  revalidatePath("/", "layout")
  revalidatePath("/notifications")
}

function isValidNotificationId(id: string): boolean {
  return UUID_PATTERN.test(id)
}

export async function markNotificationReadAction(
  id: string,
): Promise<NotificationActionResult> {
  if (!isValidNotificationId(id)) {
    return { ok: false }
  }

  const context = await requireAuthenticatedAccessContext()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_profile_id", context.user.id)
    .is("deleted_at", null)

  if (error) {
    return { ok: false }
  }

  revalidateNotificationSurfaces()
  return { ok: true }
}

export async function markNotificationUnreadAction(
  id: string,
): Promise<NotificationActionResult> {
  if (!isValidNotificationId(id)) {
    return { ok: false }
  }

  const context = await requireAuthenticatedAccessContext()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: null })
    .eq("id", id)
    .eq("recipient_profile_id", context.user.id)
    .is("deleted_at", null)

  if (error) {
    return { ok: false }
  }

  revalidateNotificationSurfaces()
  return { ok: true }
}

export async function deleteNotificationAction(
  id: string,
): Promise<NotificationActionResult> {
  if (!isValidNotificationId(id)) {
    return { ok: false }
  }

  const context = await requireAuthenticatedAccessContext()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from("notifications")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_profile_id", context.user.id)
    .is("deleted_at", null)

  if (error) {
    return { ok: false }
  }

  revalidateNotificationSurfaces()
  return { ok: true }
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  const context = await requireAuthenticatedAccessContext()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_profile_id", context.user.id)
    .is("deleted_at", null)
    .is("read_at", null)

  if (error) {
    return { ok: false }
  }

  revalidateNotificationSurfaces()
  return { ok: true }
}
