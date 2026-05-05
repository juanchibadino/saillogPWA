"use client"

import * as React from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const effectiveTheme = theme === "system" ? resolvedTheme : theme
  const isDark = effectiveTheme === "dark"
  const nextTheme = isDark ? "light" : "dark"
  const ariaLabel = mounted ? `Switch to ${nextTheme} theme` : "Toggle theme"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={() => {
        if (!mounted) {
          return
        }

        setTheme(nextTheme)
      }}
      aria-label={ariaLabel}
    >
      {mounted && isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  )
}
