import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { createPolarProCheckout } from "@/lib/billing/polar"
import { resolveRequestOrigin } from "@/lib/http/request-origin"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const createSubscriptionCheckoutInputSchema = z.object({
  organizationId: z.string().uuid(),
})

export async function POST(request: Request) {
  const context = await getCurrentAccessContext()

  if (!context.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const rawInput = await request.json().catch(() => null)
  const parsedInput = createSubscriptionCheckoutInputSchema.safeParse(rawInput)

  if (!parsedInput.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 })
  }

  if (!canManageOrganizationOperations(context, parsedInput.data.organizationId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id,name")
    .eq("id", parsedInput.data.organizationId)
    .maybeSingle()

  if (organizationError || !organization) {
    return NextResponse.json({ error: "organization_not_found" }, { status: 404 })
  }

  try {
    const origin = await resolveRequestOrigin(request)
    const checkout = await createPolarProCheckout({
      organizationId: organization.id,
      organizationName: organization.name,
      customerEmail: context.user.email ?? null,
      origin,
    })

    const adminSupabase = createAdminSupabaseClient()
    const { error: updateError } = await adminSupabase
      .from("organization_subscriptions")
      .upsert(
        {
          organization_id: organization.id,
          polar_customer_id: checkout.polarCustomerId,
          polar_checkout_id: checkout.checkoutId,
          polar_product_id: process.env.POLAR_PRO_MONTHLY_PRODUCT_ID?.trim() || null,
        },
        { onConflict: "organization_id" },
      )

    if (updateError) {
      return NextResponse.json(
        {
          error: "checkout_created_but_not_recorded",
          checkoutUrl: checkout.checkoutUrl,
          detail: updateError.message,
        },
        { status: 202 },
      )
    }

    return NextResponse.json({
      checkoutUrl: checkout.checkoutUrl,
      checkoutId: checkout.checkoutId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "checkout_failed",
        detail:
          error instanceof Error
            ? error.message
            : "Could not initialize Polar checkout.",
      },
      { status: 500 },
    )
  }
}
