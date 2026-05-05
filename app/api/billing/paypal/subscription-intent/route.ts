import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"

import {
  buildPaypalReturnUrls,
  getPaypalClientId,
  resolvePaypalProPlanId,
} from "@/lib/billing/paypal"

const createSubscriptionIntentInputSchema = z.object({
  organizationId: z.string().uuid(),
  billingCycle: z.enum(["monthly", "yearly"]),
})

export async function POST(request: Request) {
  const context = await getCurrentAccessContext()

  if (!context.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const rawInput = await request.json().catch(() => null)
  const parsedInput = createSubscriptionIntentInputSchema.safeParse(rawInput)

  if (!parsedInput.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 })
  }

  if (!canManageOrganizationOperations(context, parsedInput.data.organizationId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  try {
    const paypalPlanId = resolvePaypalProPlanId(parsedInput.data.billingCycle)
    const returnUrls = buildPaypalReturnUrls({
      requestUrl: request.url,
      organizationId: parsedInput.data.organizationId,
    })

    return NextResponse.json({
      organizationId: parsedInput.data.organizationId,
      billingCycle: parsedInput.data.billingCycle,
      paypalPlanId,
      paypalClientId: getPaypalClientId(),
      returnUrl: returnUrls.returnUrl,
      cancelUrl: returnUrls.cancelUrl,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "subscription_intent_failed",
        detail:
          error instanceof Error
            ? error.message
            : "Could not initialize PayPal billing intent.",
      },
      { status: 500 },
    )
  }
}
