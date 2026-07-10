"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

type AppNavigationStateContextValue = {
  displayPathname: string
  markNavigationIntent: (
    href: string,
    event?: React.MouseEvent<HTMLElement>,
  ) => void
}

const NAVIGATION_INTENT_RESET_DELAY_MS = 8_000

const AppNavigationStateContext =
  React.createContext<AppNavigationStateContextValue | null>(null)

function shouldIgnoreNavigationIntent(
  event?: React.MouseEvent<HTMLElement>,
): boolean {
  if (!event) {
    return false
  }

  if (event.defaultPrevented) {
    return true
  }

  if (event.button !== 0) {
    return true
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return true
  }

  const target =
    event.currentTarget instanceof HTMLAnchorElement
      ? event.currentTarget.target
      : ""

  return target.trim().length > 0 && target !== "_self"
}

function resolvePathnameFromHref(href: string): string | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const url = new URL(href, window.location.origin)

    if (url.origin !== window.location.origin) {
      return null
    }

    return url.pathname
  } catch {
    return null
  }
}

export function AppNavigationStateProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const committedPathname = usePathname()
  const [pendingPathname, setPendingPathname] = React.useState<string | null>(null)
  const displayPathname = pendingPathname ?? committedPathname

  React.useEffect(() => {
    setPendingPathname(null)
  }, [committedPathname])

  React.useEffect(() => {
    if (!pendingPathname) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setPendingPathname(null)
    }, NAVIGATION_INTENT_RESET_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [pendingPathname])

  const markNavigationIntent = React.useCallback(
    (href: string, event?: React.MouseEvent<HTMLElement>) => {
      if (shouldIgnoreNavigationIntent(event)) {
        return
      }

      const nextPathname = resolvePathnameFromHref(href)

      if (!nextPathname || nextPathname === committedPathname) {
        return
      }

      setPendingPathname(nextPathname)
    },
    [committedPathname],
  )

  const contextValue = React.useMemo<AppNavigationStateContextValue>(
    () => ({
      displayPathname,
      markNavigationIntent,
    }),
    [displayPathname, markNavigationIntent],
  )

  return (
    <AppNavigationStateContext.Provider value={contextValue}>
      {children}
    </AppNavigationStateContext.Provider>
  )
}

export function useAppNavigationState(): AppNavigationStateContextValue {
  const context = React.useContext(AppNavigationStateContext)

  if (!context) {
    throw new Error(
      "useAppNavigationState must be used within AppNavigationStateProvider.",
    )
  }

  return context
}
