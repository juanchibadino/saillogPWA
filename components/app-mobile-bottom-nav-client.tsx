"use client"

import dynamic from "next/dynamic"

import type { ResolvedNavigationScope } from "@/lib/navigation/types"

type AppMobileBottomNavClientProps = {
  canAccessApp: boolean
  navigation: ResolvedNavigationScope | null
}

const AppMobileBottomNavNoSsr = dynamic<AppMobileBottomNavClientProps>(
  () => import("@/components/app-mobile-bottom-nav").then((mod) => mod.AppMobileBottomNav),
  {
    ssr: false,
  },
)

export function AppMobileBottomNavClient(props: AppMobileBottomNavClientProps) {
  return <AppMobileBottomNavNoSsr {...props} />
}
