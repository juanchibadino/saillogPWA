import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentAccessContext } from "@/lib/auth/access"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().url().max(4096),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    auth: z.string().trim().min(1).max(1024),
    p256dh: z.string().trim().min(1).max(2048),
  }),
})

const deleteSubscriptionSchema = z.object({
  endpoint: z.string().trim().url().max(4096),
})

function toExpirationTime(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function POST(request: Request) {
  const context = await getCurrentAccessContext()

  if (!context.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const rawInput = await request.json().catch(() => null)
  const parsedInput = pushSubscriptionSchema.safeParse(rawInput)

  if (!parsedInput.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      auth: parsedInput.data.keys.auth,
      endpoint: parsedInput.data.endpoint,
      expiration_time: toExpirationTime(parsedInput.data.expirationTime),
      p256dh: parsedInput.data.keys.p256dh,
      profile_id: context.user.id,
      user_agent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
    },
    { onConflict: "profile_id,endpoint" },
  )

  if (error) {
    return NextResponse.json({ error: "save_failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const context = await getCurrentAccessContext()

  if (!context.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const rawInput = await request.json().catch(() => null)
  const parsedInput = deleteSubscriptionSchema.safeParse(rawInput)

  if (!parsedInput.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("profile_id", context.user.id)
    .eq("endpoint", parsedInput.data.endpoint)

  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
