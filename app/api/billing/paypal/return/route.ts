import { NextResponse } from "next/server"

import { NAVIGATION_SCOPE_ORG_QUERY_KEY } from "@/lib/navigation/constants"

import { isUuid } from "@/lib/billing/paypal"
import { syncOrganizationSubscriptionFromPaypal } from "@/lib/billing/subscription-sync"

function buildBillingRedirectPath(input: {
  organizationId?: string
  status?: string
  error?: string
}): string {
  const params = new URLSearchParams()

  if (input.organizationId && isUuid(input.organizationId)) {
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.organizationId)
  }

  if (input.status) {
    params.set("status", input.status)
  }

  if (input.error) {
    params.set("error", input.error)
  }

  const query = params.toString()
  return query.length > 0 ? `/billing?${query}` : "/billing"
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const subscriptionId =
    requestUrl.searchParams.get("subscription_id") ??
    requestUrl.searchParams.get("token")
  const organizationId = requestUrl.searchParams.get("org") ?? undefined

  if (!subscriptionId) {
    return NextResponse.redirect(
      new URL(
        buildBillingRedirectPath({
          organizationId,
          error: "payment_sync_failed",
        }),
        request.url,
      ),
      { status: 303 },
    )
  }

  try {
    const syncResult = await syncOrganizationSubscriptionFromPaypal({
      subscriptionId,
      fallbackOrganizationId: organizationId,
    })

    return NextResponse.redirect(
      new URL(
        buildBillingRedirectPath({
          organizationId: syncResult.organizationId,
          status: "payment_updated",
        }),
        request.url,
      ),
      { status: 303 },
    )
  } catch {
    return NextResponse.redirect(
      new URL(
        buildBillingRedirectPath({
          organizationId,
          error: "payment_sync_failed",
        }),
        request.url,
      ),
      { status: 303 },
    )
  }
}
