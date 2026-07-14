import { redirect } from "next/navigation"

type BillingRedirectSearchParams = Promise<Record<string, string | string[] | undefined>>

function appendSearchParam(
  params: URLSearchParams,
  key: string,
  value: string | string[] | undefined,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => params.append(key, entry))
    return
  }

  if (typeof value === "string") {
    params.set(key, value)
  }
}

export default async function BillingRedirectPage({
  searchParams,
}: {
  searchParams: BillingRedirectSearchParams
}) {
  const resolvedSearchParams = await searchParams
  const params = new URLSearchParams()

  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    appendSearchParam(params, key, value)
  })

  const query = params.toString()
  redirect(query.length > 0 ? `/subscription?${query}` : "/subscription")
}
