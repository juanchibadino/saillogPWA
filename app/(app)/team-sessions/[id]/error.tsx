"use client"

import * as React from "react"
import { RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function TeamSessionDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("Team session detail failed to render.", error)
  }, [error])

  return (
    <section
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-6"
    >
      <div className="max-w-xl space-y-4">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-destructive">
            Could not load team session
          </h2>
          <p className="text-sm text-muted-foreground">
            The session exists in the current route, but the detail view hit a runtime error while loading. Retry the view before changing scope.
          </p>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={reset}>
          <RotateCcwIcon className="size-4" />
          Retry
        </Button>
      </div>
    </section>
  )
}
