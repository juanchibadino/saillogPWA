"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

export function VenuesFeedback({
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
    const status = searchParams.get("status")
    const error = searchParams.get("error")

    if (statusMessage && status) {
      toast.success(statusMessage, {
        id: `venues-feedback:${pathname}:status:${status}`,
      })
    }

    if (errorMessage && error) {
      toast.error(errorMessage, {
        id: `venues-feedback:${pathname}:error:${error}`,
      })
    }

    const shouldDeleteStatus = Boolean(statusMessage && status)
    const shouldDeleteError = Boolean(errorMessage && error)

    if (!shouldDeleteStatus && !shouldDeleteError) {
      return
    }

    const nextParams = new URLSearchParams(searchParams.toString())

    if (shouldDeleteStatus) {
      nextParams.delete("status")
    }

    if (shouldDeleteError) {
      nextParams.delete("error")
    }

    const nextSearch = nextParams.toString()
    const nextUrl = nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname

    router.replace(nextUrl, { scroll: false })
  }, [errorMessage, statusMessage, searchParams, pathname, router])

  return null
}
