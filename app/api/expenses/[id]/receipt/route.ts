import { NextResponse } from "next/server"

import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import { resolveOrganizationTeamExpensesEntitlement } from "@/lib/billing/entitlements"
import { resolveNavigationScope } from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

const EXPENSE_RECEIPT_SIGNED_URL_SECONDS = 5 * 60

function buildScopeSearchParams(requestUrl: URL): ScopeSearchParams {
  const searchParams: ScopeSearchParams = {}

  requestUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value
  })

  return searchParams
}

export async function GET(request: Request, context: RouteContext) {
  const resolvedParams = await context.params
  const expenseId = resolvedParams.id?.trim()
  const requestUrl = new URL(request.url)
  const shouldDownload = requestUrl.searchParams.get("download") === "1"

  if (!expenseId) {
    return new NextResponse(null, { status: 400 })
  }

  const accessContext = await getCurrentAccessContext()

  if (!accessContext.user) {
    return new NextResponse(null, { status: 401 })
  }

  const navigation = await resolveNavigationScope({
    context: accessContext as AuthenticatedAccessContext,
    searchParams: buildScopeSearchParams(requestUrl),
  })

  if (!navigation.scope || navigation.scope.activeTeamId === null) {
    return new NextResponse(null, { status: 403 })
  }

  const expensesEntitlement = await resolveOrganizationTeamExpensesEntitlement({
    organizationId: navigation.scope.activeOrgId,
  })

  if (!expensesEntitlement.allowed) {
    return new NextResponse(null, {
      status: expensesEntitlement.reason === "payment_required" ? 402 : 403,
    })
  }

  const supabase = await createServerSupabaseClient()
  const { data: expenseRow, error: expenseError } = await supabase
    .from("team_expenses")
    .select("id,team_id,receipt_bucket,receipt_storage_path,receipt_file_name")
    .eq("id", expenseId)
    .eq("team_id", navigation.scope.activeTeamId)
    .maybeSingle()

  if (expenseError || !expenseRow) {
    return new NextResponse(null, { status: 404 })
  }

  if (!expenseRow.receipt_bucket || !expenseRow.receipt_storage_path) {
    return new NextResponse(null, { status: 404 })
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(expenseRow.receipt_bucket)
    .createSignedUrl(
      expenseRow.receipt_storage_path,
      EXPENSE_RECEIPT_SIGNED_URL_SECONDS,
      shouldDownload
        ? { download: expenseRow.receipt_file_name ?? "expense-receipt.webp" }
        : undefined,
    )

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return new NextResponse(null, { status: 502 })
  }

  return NextResponse.redirect(signedUrlData.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store",
    },
  })
}
