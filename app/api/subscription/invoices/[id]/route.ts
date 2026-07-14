import { NextResponse } from "next/server"

import { getCurrentAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { getPolarOrderInvoiceUrl } from "@/lib/billing/polar"
import { NAVIGATION_SCOPE_ORG_QUERY_KEY } from "@/lib/navigation/constants"

type InvoiceRouteContext = {
  params: Promise<{ id: string }>
}

function buildInvoiceRedirectPath(input: {
  organizationId?: string
  error: string
}): string {
  const params = new URLSearchParams({
    tab: "invoice",
    error: input.error,
  })

  if (input.organizationId) {
    params.set(NAVIGATION_SCOPE_ORG_QUERY_KEY, input.organizationId)
  }

  return `/subscription?${params.toString()}`
}

export async function GET(request: Request, context: InvoiceRouteContext) {
  const accessContext = await getCurrentAccessContext()
  const requestUrl = new URL(request.url)
  const organizationId =
    requestUrl.searchParams.get(NAVIGATION_SCOPE_ORG_QUERY_KEY)?.trim() ?? ""
  const { id } = await context.params
  const orderId = id.trim()

  if (!accessContext.user) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }

  if (
    organizationId.length === 0 ||
    orderId.length === 0 ||
    !canManageOrganizationOperations(accessContext, organizationId)
  ) {
    return NextResponse.redirect(
      new URL(
        buildInvoiceRedirectPath({
          organizationId,
          error: "forbidden",
        }),
        request.url,
      ),
    )
  }

  try {
    const invoiceUrl = await getPolarOrderInvoiceUrl({
      organizationId,
      orderId,
    })

    return NextResponse.redirect(invoiceUrl)
  } catch (error) {
    console.error("Could not open Polar invoice.", {
      organizationId,
      orderId,
      error,
    })

    return NextResponse.redirect(
      new URL(
        buildInvoiceRedirectPath({
          organizationId,
          error: "invoice_unavailable",
        }),
        request.url,
      ),
    )
  }
}
