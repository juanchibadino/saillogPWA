import { NextResponse } from "next/server"

import { getCurrentAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { resolveOrganizationSubscription } from "@/lib/billing/entitlements"
import { createServerSupabaseClient } from "@/lib/supabase/server"

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const organizationId = requestUrl.searchParams.get("org")?.trim() ?? ""

  if (!isUuid(organizationId)) {
    return NextResponse.json({ planTier: null }, { status: 400 })
  }

  const context = await getCurrentAccessContext()

  if (!context.user) {
    return NextResponse.json({ planTier: null }, { status: 401 })
  }

  if (!canManageOrganizationOperations(context, organizationId)) {
    return NextResponse.json({ planTier: null }, { status: 403 })
  }

  const supabase = await createServerSupabaseClient()

  try {
    const subscription = await resolveOrganizationSubscription(organizationId, supabase)
    return NextResponse.json({ planTier: subscription.planTier })
  } catch {
    return NextResponse.json({ planTier: null }, { status: 500 })
  }
}
