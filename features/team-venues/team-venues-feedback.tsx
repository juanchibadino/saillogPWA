"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

export function TeamVenuesFeedback({
  statusMessage,
  errorMessage,
}: {
  statusMessage: string | null
  errorMessage: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  React.useEffect(() => {
    const result = searchParams.get("result")
    const error = searchParams.get("error")

    if (statusMessage && result) {
      toast.success(statusMessage, {
        id: `team-venues-feedback:${pathname}:result:${result}`,
      })
    }

    if (errorMessage && error) {
      toast.error(errorMessage, {
        id: `team-venues-feedback:${pathname}:error:${error}`,
      })
    }

    const shouldDeleteResult = Boolean(statusMessage && result)
    const shouldDeleteError = Boolean(errorMessage && error)

    if (!shouldDeleteResult && !shouldDeleteError) {
      return
    }

    const nextParams = new URLSearchParams(searchParams.toString())

    if (shouldDeleteResult) {
      nextParams.delete("result")
      nextParams.delete("cacheTeamVenue")
    }

    if (shouldDeleteError) {
      nextParams.delete("error")
      nextParams.delete("cacheTeamVenue")
    }

    const nextSearch = nextParams.toString()
    const nextUrl = nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname

    router.replace(nextUrl, { scroll: false })
  }, [errorMessage, statusMessage, searchParams, pathname, router])

  return null
}
