import "server-only"

import { calculateConvertedExpenseAmount, getPreviousCloseRateDate } from "@/features/expenses/data-core.mjs"
import type { createServerSupabaseClient } from "@/lib/supabase/server"

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export type ExpenseRateSnapshot = {
  amountOrganizationCurrency: number
  exchangeRate: number
  exchangeRateDate: string
  exchangeRateSource: string
  organizationCurrencyCode: string
}

type FrankfurterResponse = {
  amount?: number
  base?: string
  date?: string
  rates?: Record<string, number>
}

type ExpenseExchangeRateCacheRow = {
  rate: number
  rate_date: string
  source: string
}

const EXCHANGE_RATE_SOURCE = "frankfurter"

function normalizeCurrencyCode(value: string): string {
  return value.trim().toUpperCase()
}

async function fetchFrankfurterRate(input: {
  baseCurrencyCode: string
  quoteCurrencyCode: string
  rateDate: string
}): Promise<{ rate: number; rateDate: string }> {
  const url = new URL(`https://api.frankfurter.app/${input.rateDate}`)
  url.searchParams.set("from", input.baseCurrencyCode)
  url.searchParams.set("to", input.quoteCurrencyCode)

  const response = await fetch(url, {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Exchange rate provider failed with ${response.status}`)
  }

  const payload = (await response.json()) as FrankfurterResponse
  const rate = payload.rates?.[input.quoteCurrencyCode]

  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Exchange rate provider returned an invalid rate")
  }

  return {
    rate,
    rateDate: payload.date ?? input.rateDate,
  }
}

export async function resolveExpenseRateSnapshot(input: {
  amountLocal: number
  currencyCode: string
  expenseDate: string
  organizationCurrencyCode: string
  supabase: ServerSupabaseClient
}): Promise<ExpenseRateSnapshot> {
  const currencyCode = normalizeCurrencyCode(input.currencyCode)
  const organizationCurrencyCode = normalizeCurrencyCode(input.organizationCurrencyCode)

  if (currencyCode === organizationCurrencyCode) {
    return {
      amountOrganizationCurrency: calculateConvertedExpenseAmount({
        amountLocal: input.amountLocal,
        exchangeRate: 1,
      }),
      exchangeRate: 1,
      exchangeRateDate: input.expenseDate,
      exchangeRateSource: "same_currency",
      organizationCurrencyCode,
    }
  }

  const requestedRateDate = getPreviousCloseRateDate(input.expenseDate)
  const { data: cachedRate, error: cachedRateError } = await input.supabase
    .from("expense_exchange_rates")
    .select("rate,rate_date,source")
    .eq("base_currency_code", currencyCode)
    .eq("quote_currency_code", organizationCurrencyCode)
    .eq("rate_date", requestedRateDate)
    .eq("source", EXCHANGE_RATE_SOURCE)
    .maybeSingle()

  if (cachedRateError) {
    throw new Error(`Could not load cached exchange rate: ${cachedRateError.message}`)
  }

  let rateSnapshot: ExpenseExchangeRateCacheRow | null = cachedRate
    ? {
        rate: Number(cachedRate.rate),
        rate_date: cachedRate.rate_date,
        source: cachedRate.source,
      }
    : null

  if (!rateSnapshot) {
    const providerRate = await fetchFrankfurterRate({
      baseCurrencyCode: currencyCode,
      quoteCurrencyCode: organizationCurrencyCode,
      rateDate: requestedRateDate,
    })
    const { error: upsertError } = await input.supabase
      .from("expense_exchange_rates")
      .upsert(
        {
          base_currency_code: currencyCode,
          quote_currency_code: organizationCurrencyCode,
          rate_date: providerRate.rateDate,
          source: EXCHANGE_RATE_SOURCE,
          rate: providerRate.rate,
          fetched_at: new Date().toISOString(),
        },
        {
          onConflict: "base_currency_code,quote_currency_code,rate_date,source",
        },
      )

    if (upsertError) {
      throw new Error(`Could not cache exchange rate: ${upsertError.message}`)
    }

    rateSnapshot = {
      rate: providerRate.rate,
      rate_date: providerRate.rateDate,
      source: EXCHANGE_RATE_SOURCE,
    }
  }

  if (!rateSnapshot) {
    throw new Error("Exchange rate snapshot was not resolved")
  }

  const exchangeRate = Number(rateSnapshot.rate)

  return {
    amountOrganizationCurrency: calculateConvertedExpenseAmount({
      amountLocal: input.amountLocal,
      exchangeRate,
    }),
    exchangeRate,
    exchangeRateDate: rateSnapshot.rate_date,
    exchangeRateSource: rateSnapshot.source,
    organizationCurrencyCode,
  }
}
