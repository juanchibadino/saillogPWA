"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"

const DEFAULT_DURATION_MS = 7_000

type FeedbackParamKey = "status" | "result"

type FeedbackToastProps = {
  statusMessage?: string | null
  errorMessage?: string | null
  statusParamKey?: FeedbackParamKey | null
  errorParamKey?: "error" | null
  durationMs?: number
}

function FeedbackToastMessage({
  tone,
  message,
  onClose,
}: {
  tone: "success" | "error"
  message: string
  onClose: () => void
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-xl items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
        tone === "success"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-rose-300 bg-rose-50 text-rose-800",
      )}
      role="status"
      aria-live="polite"
    >
      <p className="pt-1">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close message"
        className={cn(
          "-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors",
          tone === "success"
            ? "text-emerald-800/80 hover:bg-emerald-100 hover:text-emerald-900"
            : "text-rose-800/80 hover:bg-rose-100 hover:text-rose-900",
        )}
      >
        <XIcon className="size-4" />
      </button>
    </div>
  )
}

export function FeedbackToast({
  statusMessage = null,
  errorMessage = null,
  statusParamKey = "status",
  errorParamKey = "error",
  durationMs = DEFAULT_DURATION_MS,
}: FeedbackToastProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [activeStatusMessage, setActiveStatusMessage] = React.useState<string | null>(
    statusMessage,
  )
  const [activeErrorMessage, setActiveErrorMessage] = React.useState<string | null>(errorMessage)
  const [isStatusVisible, setIsStatusVisible] = React.useState(Boolean(statusMessage))
  const [isErrorVisible, setIsErrorVisible] = React.useState(Boolean(errorMessage))

  React.useEffect(() => {
    if (!statusMessage) {
      return
    }

    setActiveStatusMessage(statusMessage)
    setIsStatusVisible(true)
  }, [statusMessage])

  React.useEffect(() => {
    if (!errorMessage) {
      return
    }

    setActiveErrorMessage(errorMessage)
    setIsErrorVisible(true)
  }, [errorMessage])

  React.useEffect(() => {
    if (!activeStatusMessage || !isStatusVisible) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsStatusVisible(false)
    }, durationMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeStatusMessage, durationMs, isStatusVisible])

  React.useEffect(() => {
    if (!activeErrorMessage || !isErrorVisible) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsErrorVisible(false)
    }, durationMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeErrorMessage, durationMs, isErrorVisible])

  React.useEffect(() => {
    const shouldDeleteStatus =
      statusParamKey !== null && Boolean(statusMessage) && searchParams.has(statusParamKey)
    const shouldDeleteError =
      errorParamKey !== null && Boolean(errorMessage) && searchParams.has(errorParamKey)

    if (!shouldDeleteStatus && !shouldDeleteError) {
      return
    }

    const nextParams = new URLSearchParams(searchParams.toString())

    if (shouldDeleteStatus && statusParamKey) {
      nextParams.delete(statusParamKey)
    }

    if (shouldDeleteError && errorParamKey) {
      nextParams.delete(errorParamKey)
    }

    const nextSearch = nextParams.toString()
    const nextUrl = nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname

    router.replace(nextUrl, { scroll: false })
  }, [errorMessage, errorParamKey, pathname, router, searchParams, statusMessage, statusParamKey])

  const hasVisibleToast =
    (activeStatusMessage && isStatusVisible) || (activeErrorMessage && isErrorVisible)

  if (!hasVisibleToast) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      {activeStatusMessage && isStatusVisible ? (
        <FeedbackToastMessage
          tone="success"
          message={activeStatusMessage}
          onClose={() => {
            setIsStatusVisible(false)
          }}
        />
      ) : null}

      {activeErrorMessage && isErrorVisible ? (
        <FeedbackToastMessage
          tone="error"
          message={activeErrorMessage}
          onClose={() => {
            setIsErrorVisible(false)
          }}
        />
      ) : null}
    </div>
  )
}
