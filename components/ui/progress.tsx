"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: React.ComponentProps<"div"> & {
  value?: number | null
  indicatorClassName?: string
}) {
  const normalizedValue = Math.min(100, Math.max(0, value ?? 0))

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={normalizedValue}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn("h-full w-full flex-1 bg-primary transition-all", indicatorClassName)}
        style={{ transform: `translateX(-${100 - normalizedValue}%)` }}
      />
    </div>
  )
}

export { Progress }
