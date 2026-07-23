import type { Database } from "@/types/database"

export type ExpenseType = Database["public"]["Enums"]["expense_type"]
export type ExpenseVisibilityScope = "mine" | "team"

export const TEAM_EXPENSE_TYPE_OPTIONS: Array<{
  value: ExpenseType
  label: string
}> = [
  { value: "meals", label: "Meals" },
  { value: "accommodation", label: "Accommodation" },
  { value: "transport", label: "Transport" },
  { value: "fuel", label: "Fuel" },
  { value: "marina_fees", label: "Marina fees" },
  { value: "race_fees", label: "Race fees" },
  { value: "supplies", label: "Supplies" },
  { value: "gear", label: "Gear" },
  { value: "coaching", label: "Coaching" },
  { value: "other", label: "Other" },
]

export const COMMON_EXPENSE_CURRENCIES = [
  "USD",
  "EUR",
  "DKK",
  "PLN",
  "GBP",
  "HUF",
  "ARS",
  "JPY",
  "AUD",
  "NZD",
] as const

const EXPENSE_TYPE_LABELS = new Map(
  TEAM_EXPENSE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)

export function formatExpenseTypeLabel(value: ExpenseType): string {
  return EXPENSE_TYPE_LABELS.get(value) ?? value
}

export function formatCurrencyAmount(input: {
  amount: number
  currencyCode: string
}): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: input.currencyCode,
    maximumFractionDigits: 2,
  }).format(input.amount)
}

export function formatExpenseDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date)
}

export function normalizeCurrencyCode(value: string | null | undefined): string {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : ""

  return /^[A-Z]{3}$/.test(normalized) ? normalized : "USD"
}
