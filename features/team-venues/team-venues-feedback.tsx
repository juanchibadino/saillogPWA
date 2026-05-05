"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

const STATUS_AUTO_DISMISS_MS = 15_000

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
  const [activeStatusMessage, setActiveStatusMessage] = React.useState<string | null>(
    statusMessage,
  )
  const [isStatusVisible, setIsStatusVisible] = React.useState(Boolean(statusMessage))

  React.useEffect(() => {
    if (!statusMessage) {
      return
    }

    setActiveStatusMessage(statusMessage)
    setIsStatusVisible(true)
  }, [statusMessage])

  React.useEffect(() => {
    if (!activeStatusMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsStatusVisible(false)
    }, STATUS_AUTO_DISMISS_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeStatusMessage])

  React.useEffect(() => {
    const status = searchParams.get("status")
    if (!statusMessage || !status) {
      return
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("status")
    const nextSearch = nextParams.toString()
    const nextUrl = nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname

    router.replace(nextUrl, { scroll: false })
  }, [statusMessage, searchParams, pathname, router])

  return (
    <>
      {activeStatusMessage && isStatusVisible ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {activeStatusMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </p>
      ) : null}
    </>
  )
}
