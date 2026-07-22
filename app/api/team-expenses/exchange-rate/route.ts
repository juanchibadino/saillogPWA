import { NextResponse } from "next/server"

import { resolveExpenseRateSnapshot } from "@/features/expenses/exchange-rates"
import {
  getCurrentAccessContext,
  type AuthenticatedAccessContext,
} from "@/lib/auth/access"
import { resolveNavigationScope } from "@/lib/navigation/scope"
import type { ScopeSearchParams } from "@/lib/navigation/types"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { expenseRateInputSchema } from "@/lib/validation/expenses"

function buildScopeSearchParams(requestUrl: URL): ScopeSearchParams {
  const searchParams: ScopeSearchParams = {}

  requestUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value
  })

  return searchParams
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const accessContext = await getCurrentAccessContext()

  if (!accessContext.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const context = accessContext as AuthenticatedAccessContext
  const navigation = await resolveNavigationScope({
    context,
    searchParams: buildScopeSearchParams(requestUrl),
  })

  if (!navigation.scope || navigation.scope.activeTeamId === null) {
    return NextResponse.json({ error: "scope_required" }, { status: 403 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: organizationRow, error: organizationError } = await supabase
    .from("organizations")
    .select("default_currency_code")
    .eq("id", navigation.scope.activeOrgId)
    .maybeSingle()

  if (organizationError || !organizationRow) {
    return NextResponse.json(
      {
        error: "organization_not_found",
        detail: organizationError?.message,
      },
      { status: 404 },
    )
  }

  const parsed = expenseRateInputSchema.safeParse({
    amountLocal: requestUrl.searchParams.get("amountLocal"),
    currencyCode: requestUrl.searchParams.get("currencyCode"),
    expenseDate: requestUrl.searchParams.get("expenseDate"),
    organizationCurrencyCode: organizationRow.default_currency_code ?? "USD",
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_exchange_rate_input", detail: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const snapshot = await resolveExpenseRateSnapshot({
      ...parsed.data,
      supabase,
    })

    return NextResponse.json(snapshot)
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown exchange rate error"

    return NextResponse.json(
      { error: "exchange_rate_failed", detail },
      { status: 502 },
    )
  }
}
