import { NextResponse } from "next/server"

import { getCurrentAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { createPolarCustomerPortalUrl } from "@/lib/billing/polar"
import { resolveRequestOrigin } from "@/lib/http/request-origin"
import { NAVIGATION_SCOPE_ORG_QUERY_KEY } from "@/lib/navigation/constants"

function buildSubscriptionRedirectPath(input: {
  organizationId?: string
  error: string
}): string {
  const params = new URLSearchParams({
    tab: "billing",
    error: input.error,
  })

  if (input.organizationId) {
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.organizationId)
  }

  return `/subscription?${params.toString()}`
}

export async function GET(request: Request) {
  const context = await getCurrentAccessContext()
  const requestUrl = new URL(request.url)
  const organizationId =
    requestUrl.searchParams.get(NAVIGATION_SCOPE_ORG_QUERY_KEY)?.trim() ?? ""

  if (!context.user) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }

  if (!organizationId || !canManageOrganizationOperations(context, organizationId)) {
    return NextResponse.redirect(
      new URL(
        buildSubscriptionRedirectPath({
          organizationId,
          error: "forbidden",
        }),
        request.url,
      ),
    )
  }

  try {
    const origin = await resolveRequestOrigin(request)
    const portalUrl = await createPolarCustomerPortalUrl({
      organizationId,
      origin,
    })

    return NextResponse.redirect(portalUrl)
  } catch {
    return NextResponse.redirect(
      new URL(
        buildSubscriptionRedirectPath({
          organizationId,
          error: "portal_unavailable",
        }),
        request.url,
      ),
    )
  }
}
