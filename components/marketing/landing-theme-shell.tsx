"use client";

import * as React from "react";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LandingTheme = "dark" | "light";

type LandingThemeContextValue = {
  theme: LandingTheme;
  toggleTheme: () => void;
};

const LandingThemeContext = React.createContext<LandingThemeContextValue | null>(null);

export function LandingThemeShell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<LandingTheme>("dark");

  const value = React.useMemo<LandingThemeContextValue>(
    () => ({
      theme,
      toggleTheme: () => {
        setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
      },
    }),
    [theme],
  );

  return (
    <LandingThemeContext.Provider value={value}>
      <div className={cn(theme === "dark" ? "dark" : "", "min-h-screen")}>
        {children}
      </div>
    </LandingThemeContext.Provider>
  );
}

export function LandingThemeToggle() {
  const context = React.useContext(LandingThemeContext);

  if (!context) {
    return null;
  }

  const isDark = context.theme === "dark";
  const label = isDark ? "Light" : "Dark";
  const Icon = isDark ? SunIcon : MoonIcon;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="border-border bg-background/80 text-foreground hover:bg-muted"
      onClick={context.toggleTheme}
      aria-label={`Switch landing to ${label.toLowerCase()} theme`}
    >
      <Icon className="size-3.5" />
    </Button>
  );
}
