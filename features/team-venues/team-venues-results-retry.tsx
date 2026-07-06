"use client"

import { useTransition } from "react"
import { Loader2Icon, RotateCcwIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

export function TeamVenuesResultsRetry({
  message = "Could not load venue results.",
}: {
  message?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <section
      role="alert"
      aria-live="polite"
      className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Venue results unavailable</h2>
          <p className="text-sm text-amber-800">{message}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          className="border-amber-300 bg-background text-foreground"
          onClick={() => {
            startTransition(() => {
              router.refresh()
            })
          }}
        >
          {isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RotateCcwIcon className="size-4" />
          )}
          {isPending ? "Retrying..." : "Retry results"}
        </Button>
      </div>
    </section>
  )
}
