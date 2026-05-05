import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"

import { syncOrganizationSubscriptionFromPaypal } from "@/lib/billing/subscription-sync"

const activateSubscriptionInputSchema = z.object({
  organizationId: z.string().uuid(),
  subscriptionId: z.string().min(1),
})

export async function POST(request: Request) {
  const context = await getCurrentAccessContext()

  if (!context.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const rawInput = await request.json().catch(() => null)
  const parsedInput = activateSubscriptionInputSchema.safeParse(rawInput)

  if (!parsedInput.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 })
  }

  if (!canManageOrganizationOperations(context, parsedInput.data.organizationId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  try {
    const syncResult = await syncOrganizationSubscriptionFromPaypal({
      subscriptionId: parsedInput.data.subscriptionId,
      fallbackOrganizationId: parsedInput.data.organizationId,
      createdByProfileId: context.profile?.id ?? null,
    })

    return NextResponse.json({
      status: "ok",
      subscription: syncResult,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "activation_failed",
        detail: error instanceof Error ? error.message : "Unexpected activation failure",
      },
      { status: 500 },
    )
  }
}
