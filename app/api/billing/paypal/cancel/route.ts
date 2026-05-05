import { NextResponse } from "next/server"

import { NAVIGATION_SCOPE_ORG_QUERY_KEY } from "@/lib/navigation/constants"

import { isUuid } from "@/lib/billing/paypal"

function buildBillingRedirectPath(input: { organizationId?: string; error: string }): string {
  const params = new URLSearchParams()

  if (input.organizationId && isUuid(input.organizationId)) {
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.organizationId)
  }

  params.set("error", input.error)

  return `/billing?${params.toString()}`
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const organizationId = requestUrl.searchParams.get("org") ?? undefined

  return NextResponse.redirect(
    new URL(
      buildBillingRedirectPath({
        organizationId,
        error: "checkout_cancelled",
      }),
      request.url,
    ),
    { status: 303 },
  )
}
