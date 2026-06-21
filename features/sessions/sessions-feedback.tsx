"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

const STATUS_AUTO_DISMISS_MS = 15_000
type SessionsFeedbackMode = "inline" | "toast"

export function SessionsFeedback({
  statusMessage,
  errorMessage,
  mode = "inline",
}: {
  statusMessage: string | null
  errorMessage: string | null
  mode?: SessionsFeedbackMode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeStatusMessage, setActiveStatusMessage] = React.useState<string | null>(
    statusMessage,
  )
  const [isStatusVisible, setIsStatusVisible] = React.useState(Boolean(statusMessage))

  React.useEffect(() => {
    if (mode !== "inline") {
      return
    }

    if (!statusMessage) {
      return
    }

    setActiveStatusMessage(statusMessage)
    setIsStatusVisible(true)
  }, [mode, statusMessage])

  React.useEffect(() => {
    if (mode !== "inline") {
      return
    }

    if (!activeStatusMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsStatusVisible(false)
    }, STATUS_AUTO_DISMISS_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeStatusMessage, mode])

  React.useEffect(() => {
    const status = searchParams.get("status")
    const error = searchParams.get("error")

    if (mode === "toast") {
      if (statusMessage && status) {
        toast.success(statusMessage, {
          id: `sessions-feedback:${pathname}:status:${status}`,
        })
      }

      if (errorMessage && error) {
        toast.error(errorMessage, {
          id: `sessions-feedback:${pathname}:error:${error}`,
        })
      }
    }

    const shouldDeleteStatus = Boolean(statusMessage && status)
    const shouldDeleteError = mode === "toast" && Boolean(errorMessage && error)

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
  }, [errorMessage, mode, statusMessage, searchParams, pathname, router])

  if (mode === "toast") {
    return null
  }

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
