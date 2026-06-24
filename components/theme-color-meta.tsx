"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"

const LIGHT_THEME_COLOR = "#ffffff"
const DARK_THEME_COLOR = "#0a0a0a"

function resolveThemeColor(input: {
  resolvedTheme?: string
  theme?: string
}): string {
  const effectiveTheme = input.theme === "system" ? input.resolvedTheme : input.theme

  if (effectiveTheme === "dark") {
    return DARK_THEME_COLOR
  }

  if (effectiveTheme === "light") {
    return LIGHT_THEME_COLOR
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? DARK_THEME_COLOR
    : LIGHT_THEME_COLOR
}

export function ThemeColorMeta() {
  const pathname = usePathname()
  const { resolvedTheme, theme } = useTheme()

  React.useEffect(() => {
    const themeColor = resolveThemeColor({ resolvedTheme, theme })
    const metaElements = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
    )

    if (metaElements.length === 0) {
      const metaElement = document.createElement("meta")
      metaElement.name = "theme-color"
      metaElement.content = themeColor
      document.head.appendChild(metaElement)
      return
    }

    for (const metaElement of metaElements) {
      metaElement.content = themeColor
    }
  }, [pathname, resolvedTheme, theme])

  return null
}
