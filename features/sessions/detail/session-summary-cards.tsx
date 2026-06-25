"use client"

import * as React from "react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type SessionDetailSummaryCardsProps = {
  sessionTypeLabel: string
  sessionDateLabel: string
  dockOutLabel: string
  durationLabel: string
}

const COLLAPSE_SCROLL_THRESHOLD_PX = 24

function findScrollRoot(element: HTMLElement): HTMLElement | Window {
  let parent = element.parentElement

  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY

    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return parent
    }

    parent = parent.parentElement
  }

  return window
}

function getScrollTop(scrollRoot: HTMLElement | Window): number {
  return "scrollTop" in scrollRoot ? scrollRoot.scrollTop : window.scrollY
}

export function SessionDetailSummaryCards({
  sessionTypeLabel,
  sessionDateLabel,
  dockOutLabel,
  durationLabel,
}: SessionDetailSummaryCardsProps) {
  const summaryRef = React.useRef<HTMLDivElement>(null)
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  React.useEffect(() => {
    const summaryElement = summaryRef.current

    if (!summaryElement) {
      return
    }

    const scrollRoot = findScrollRoot(summaryElement)
    let animationFrameId = 0

    function updateCollapsedState() {
      animationFrameId = 0
      const nextIsCollapsed = getScrollTop(scrollRoot) > COLLAPSE_SCROLL_THRESHOLD_PX
      setIsCollapsed((currentValue) =>
        currentValue === nextIsCollapsed ? currentValue : nextIsCollapsed,
      )
    }

    function requestCollapsedStateUpdate() {
      if (animationFrameId !== 0) {
        return
      }

      animationFrameId = window.requestAnimationFrame(updateCollapsedState)
    }

    updateCollapsedState()
    scrollRoot.addEventListener("scroll", requestCollapsedStateUpdate, { passive: true })
    window.addEventListener("resize", requestCollapsedStateUpdate)

    return () => {
      if (animationFrameId !== 0) {
        window.cancelAnimationFrame(animationFrameId)
      }

      scrollRoot.removeEventListener("scroll", requestCollapsedStateUpdate)
      window.removeEventListener("resize", requestCollapsedStateUpdate)
    }
  }, [])

  const summaryItems = [
    { label: "Type", value: sessionTypeLabel, isTabular: false },
    { label: "Date", value: sessionDateLabel, isTabular: false },
    { label: "Dock Out", value: dockOutLabel, isTabular: true },
    { label: "Duration", value: durationLabel, isTabular: true },
  ]

  return (
    <div
      ref={summaryRef}
      aria-hidden={isCollapsed}
      className={cn(
        "grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out",
        isCollapsed
          ? "pointer-events-none -mt-4 grid-rows-[0fr] opacity-0"
          : "grid-rows-[1fr] opacity-100",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <Card className="overflow-hidden p-0 md:hidden">
          <div className="divide-y divide-border px-6 py-3">
            {summaryItems.map((item) => (
              <div
                key={`mobile-session-summary-${item.label}`}
                className="flex min-h-12 items-center justify-between gap-4"
              >
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p
                  className={cn(
                    "text-right text-sm font-semibold",
                    item.isTabular ? "tabular-nums" : null,
                  )}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <div className="hidden gap-4 md:grid md:grid-cols-4">
          {summaryItems.map((item) => (
            <Card key={`desktop-session-summary-${item.label}`}>
              <CardHeader>
                <CardDescription>{item.label}</CardDescription>
                <CardTitle
                  className={cn(
                    "text-xl font-semibold",
                    item.isTabular ? "tabular-nums" : null,
                  )}
                >
                  {item.value}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
