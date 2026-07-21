"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  SESSION_DETAIL_TABS,
  type SessionDetailTab,
} from "@/features/sessions/navigation"

export function resolveSessionDetailTab(value: string): SessionDetailTab {
  return SESSION_DETAIL_TABS.includes(value as SessionDetailTab)
    ? (value as SessionDetailTab)
    : "info"
}

const MOBILE_SESSION_DETAIL_TAB_LIST_X_PADDING = 6

const MOBILE_SESSION_DETAIL_TAB_MEASURE_TRIGGER_CLASS =
  "relative inline-flex h-[calc(100%-1px)] flex-none items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap"

type MobileSessionDetailTabWidthMap = Record<SessionDetailTab, number>

type MobileSessionDetailTabMetrics = {
  containerWidth: number
  moreWidth: number
  tabWidths: MobileSessionDetailTabWidthMap
}

export function formatSessionDetailTabLabel(tab: SessionDetailTab): string {
  if (tab === "analytics") {
    return "Files"
  }

  return tab.charAt(0).toUpperCase() + tab.slice(1)
}

function getMobileSessionDetailTabsWidth(
  tabs: readonly SessionDetailTab[],
  tabWidths: MobileSessionDetailTabWidthMap,
): number {
  return tabs.reduce(
    (totalWidth, tab) => totalWidth + tabWidths[tab],
    MOBILE_SESSION_DETAIL_TAB_LIST_X_PADDING,
  )
}

function getVisibleMobileSessionDetailTabs(input: {
  metrics: MobileSessionDetailTabMetrics
  orderedTabs: readonly SessionDetailTab[]
  requiredTab?: SessionDetailTab
}): SessionDetailTab[] {
  const allTabsWidth = getMobileSessionDetailTabsWidth(
    SESSION_DETAIL_TABS,
    input.metrics.tabWidths,
  )

  if (allTabsWidth <= input.metrics.containerWidth) {
    return [...SESSION_DETAIL_TABS]
  }

  const availableTabsWidth = Math.max(
    0,
    input.metrics.containerWidth -
      input.metrics.moreWidth -
      MOBILE_SESSION_DETAIL_TAB_LIST_X_PADDING,
  )
  const visibleTabs: SessionDetailTab[] = []
  let usedTabsWidth = 0

  for (const tab of input.orderedTabs) {
    const tabWidth = input.metrics.tabWidths[tab]

    if (tab === input.requiredTab) {
      while (visibleTabs.length > 0 && usedTabsWidth + tabWidth > availableTabsWidth) {
        const removedTab = visibleTabs.pop()

        if (!removedTab) {
          break
        }

        usedTabsWidth -= input.metrics.tabWidths[removedTab]
      }

      if (visibleTabs.length === 0 || usedTabsWidth + tabWidth <= availableTabsWidth) {
        visibleTabs.push(tab)
        usedTabsWidth += tabWidth
      }

      continue
    }

    if (visibleTabs.length === 0 || usedTabsWidth + tabWidth <= availableTabsWidth) {
      visibleTabs.push(tab)
      usedTabsWidth += tabWidth
    }
  }

  return visibleTabs.length > 0 ? visibleTabs : [input.orderedTabs[0] ?? "info"]
}

function moveMobileSessionDetailTabIntoView(input: {
  orderedTabs: readonly SessionDetailTab[]
  tab: SessionDetailTab
  visibleTabs: readonly SessionDetailTab[]
}): SessionDetailTab[] {
  if (input.visibleTabs.includes(input.tab)) {
    return [...input.orderedTabs]
  }

  const tabIndex = input.orderedTabs.indexOf(input.tab)
  const replacementTab = input.visibleTabs.at(-1)

  if (tabIndex === -1 || !replacementTab) {
    return [...input.orderedTabs]
  }

  const replacementIndex = input.orderedTabs.indexOf(replacementTab)

  if (replacementIndex === -1) {
    return [...input.orderedTabs]
  }

  const nextOrderedTabs = [...input.orderedTabs]
  nextOrderedTabs[replacementIndex] = input.tab
  nextOrderedTabs[tabIndex] = replacementTab
  return nextOrderedTabs
}

function areMobileSessionDetailTabMetricsEqual(
  left: MobileSessionDetailTabMetrics,
  right: MobileSessionDetailTabMetrics,
): boolean {
  if (left.containerWidth !== right.containerWidth || left.moreWidth !== right.moreWidth) {
    return false
  }

  return SESSION_DETAIL_TABS.every((tab) => left.tabWidths[tab] === right.tabWidths[tab])
}

export function MobileSessionDetailTabsList(input: {
  selectedTab: SessionDetailTab
  onTabChange: (tab: SessionDetailTab) => void
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const moreMeasureRef = React.useRef<HTMLButtonElement | null>(null)
  const tabMeasureRefs = React.useRef<
    Partial<Record<SessionDetailTab, HTMLButtonElement | null>>
  >({})
  const [metrics, setMetrics] = React.useState<MobileSessionDetailTabMetrics | null>(null)
  const [tabOrder, setTabOrder] = React.useState<SessionDetailTab[]>(() => [
    ...SESSION_DETAIL_TABS,
  ])

  const measureTabs = React.useCallback(() => {
    const container = containerRef.current
    const moreMeasure = moreMeasureRef.current

    if (!container || !moreMeasure) {
      return
    }

    const nextTabWidths = {} as MobileSessionDetailTabWidthMap

    for (const tab of SESSION_DETAIL_TABS) {
      const tabMeasure = tabMeasureRefs.current[tab]

      if (!tabMeasure) {
        return
      }

      nextTabWidths[tab] = Math.ceil(tabMeasure.getBoundingClientRect().width)
    }

    const nextMetrics: MobileSessionDetailTabMetrics = {
      containerWidth: Math.floor(container.getBoundingClientRect().width),
      moreWidth: Math.ceil(moreMeasure.getBoundingClientRect().width),
      tabWidths: nextTabWidths,
    }

    if (nextMetrics.containerWidth <= 0 || nextMetrics.moreWidth <= 0) {
      return
    }

    setMetrics((currentMetrics) =>
      currentMetrics && areMobileSessionDetailTabMetricsEqual(currentMetrics, nextMetrics)
        ? currentMetrics
        : nextMetrics,
    )
  }, [])

  React.useEffect(() => {
    measureTabs()

    const animationFrame = window.requestAnimationFrame(measureTabs)
    const container = containerRef.current
    const resizeObserver =
      typeof ResizeObserver === "undefined" || !container
        ? null
        : new ResizeObserver(() => {
            measureTabs()
          })

    if (resizeObserver && container) {
      resizeObserver.observe(container)
    }

    window.addEventListener("resize", measureTabs)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", measureTabs)
    }
  }, [measureTabs])

  const visibleTabs = React.useMemo(
    () =>
      metrics
        ? getVisibleMobileSessionDetailTabs({
            metrics,
            orderedTabs: tabOrder,
            requiredTab: input.selectedTab,
          })
        : [...SESSION_DETAIL_TABS],
    [input.selectedTab, metrics, tabOrder],
  )
  const allTabsVisible = visibleTabs.length === SESSION_DETAIL_TABS.length
  const overflowTabs = allTabsVisible
    ? []
    : tabOrder.filter((tab) => !visibleTabs.includes(tab))

  function setTabMeasureRef(tab: SessionDetailTab) {
    return (node: HTMLButtonElement | null) => {
      tabMeasureRefs.current[tab] = node
    }
  }

  function handleOverflowTabSelect(tab: SessionDetailTab): void {
    setTabOrder((currentTabOrder) => {
      if (!metrics) {
        return currentTabOrder
      }

      const currentVisibleTabs = getVisibleMobileSessionDetailTabs({
        metrics,
        orderedTabs: currentTabOrder,
      })

      return moveMobileSessionDetailTabIntoView({
        orderedTabs: currentTabOrder,
        tab,
        visibleTabs: currentVisibleTabs,
      })
    })
    input.onTabChange(tab)
  }

  return (
    <div ref={containerRef} className="w-full">
      <div className="flex h-11 w-full max-w-full items-center rounded-lg bg-muted p-[3px] text-muted-foreground">
        <TabsList
          className="h-full min-w-0 flex-1 rounded-md bg-transparent p-0 group-data-horizontal/tabs:h-full"
        >
          {visibleTabs.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="min-w-0 basis-0 px-2 capitalize"
            >
              {formatSessionDetailTabLabel(tab)}
            </TabsTrigger>
          ))}
        </TabsList>

        {!allTabsVisible ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-full shrink-0 rounded-md px-2.5 text-foreground/60 hover:text-foreground"
                />
              }
            >
              <span>More</span>
              <ChevronDownIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {overflowTabs.map((tab) => (
                <DropdownMenuItem
                  key={tab}
                  onClick={() => handleOverflowTabSelect(tab)}
                  className="gap-2"
                >
                  <span className="flex size-4 items-center justify-center">
                    {input.selectedTab === tab ? <CheckIcon className="size-4" /> : null}
                  </span>
                  <span className="flex-1">{formatSessionDetailTabLabel(tab)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 -z-10 opacity-0"
      >
        <div className="inline-flex h-11 items-center rounded-lg bg-muted p-[3px] text-muted-foreground">
          {SESSION_DETAIL_TABS.map((tab) => (
            <button
              key={tab}
              ref={setTabMeasureRef(tab)}
              type="button"
              tabIndex={-1}
              className={MOBILE_SESSION_DETAIL_TAB_MEASURE_TRIGGER_CLASS}
            >
              {formatSessionDetailTabLabel(tab)}
            </button>
          ))}
          <button
            ref={moreMeasureRef}
            type="button"
            tabIndex={-1}
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "h-full rounded-md px-2.5",
            })}
          >
            <span>More</span>
            <ChevronDownIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
