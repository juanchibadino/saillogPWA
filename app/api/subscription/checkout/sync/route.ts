import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { syncPolarCheckoutCompletion } from "@/lib/billing/polar"

const syncSubscriptionCheckoutInputSchema = z.object({
  organizationId: z.string().uuid(),
  checkoutId: z.string().min(1),
})

export async function POST(request: Request) {
  const context = await getCurrentAccessContext()

  if (!context.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const rawInput = await request.json().catch(() => null)
  const parsedInput = syncSubscriptionCheckoutInputSchema.safeParse(rawInput)

  if (!parsedInput.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 })
  }

  if (!canManageOrganizationOperations(context, parsedInput.data.organizationId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  try {
    const result = await syncPolarCheckoutCompletion(parsedInput.data)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: "checkout_sync_failed",
        detail:
          error instanceof Error
            ? error.message
            : "Could not sync Polar checkout.",
      },
      { status: 500 },
    )
  }
}
