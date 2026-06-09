"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

type SessionMobileSummaryProps = {
  startTime: string
  endTime: string
  totalDuration: string
}

function SummaryRow({
  label,
  value,
  trailing,
}: {
  label: string
  value: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/35 px-4 py-3">
      <p className="text-sm text-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium tabular-nums text-foreground">{value}</p>
        {trailing}
      </div>
    </div>
  )
}

export function SessionMobileSummary({
  startTime,
  endTime,
  totalDuration,
}: SessionMobileSummaryProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={() => setIsExpanded((currentValue) => !currentValue)}
      aria-expanded={isExpanded}
      aria-label="Toggle session summary details"
    >
      <div className="space-y-2">
        {isExpanded ? <SummaryRow label="Start Time" value={startTime} /> : null}
        {isExpanded ? <SummaryRow label="End Time" value={endTime} /> : null}

        <SummaryRow
          label="Total Duration"
          value={totalDuration}
          trailing={
            <ChevronDownIcon
              className={`size-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          }
        />
      </div>
    </button>
  )
}
