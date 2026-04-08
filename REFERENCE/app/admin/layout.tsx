"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const isLoginRoute = pathname === "/admin/login"
  const [checked, setChecked] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    if (isLoginRoute) {
      return
    }

    let ignore = false
    let initialResolved = false
    const supabase = createSupabaseBrowserClient()
    const fallbackTimer = window.setTimeout(() => {
      applyInitialAuthState(false)
    }, 5000)

    function applyAuthState(hasSession: boolean) {
      if (ignore) {
        return
      }

      setIsAuthenticated(hasSession)
      setChecked(true)

      if (!hasSession) {
        router.replace("/admin/login")
      }
    }

    function applyInitialAuthState(hasSession: boolean) {
      if (ignore || initialResolved) {
        return
      }

      initialResolved = true
      window.clearTimeout(fallbackTimer)
      applyAuthState(hasSession)
    }

    function applyLiveAuthState(hasSession: boolean) {
      if (!initialResolved) {
        initialResolved = true
        window.clearTimeout(fallbackTimer)
      }

      applyAuthState(hasSession)
    }

    async function verifySession() {
      try {
        const { data, error } = await supabase.auth.getSession()
        const hasSession = !error && Boolean(data.session)
        applyInitialAuthState(hasSession)
      } catch {
        applyInitialAuthState(false)
      }
    }

    void verifySession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (ignore) {
        return
      }

      if (event === "SIGNED_OUT") {
        applyLiveAuthState(false)
        return
      }

      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        if (event === "INITIAL_SESSION") {
          applyInitialAuthState(Boolean(session))
          return
        }

        applyLiveAuthState(Boolean(session))
      }
    })

    return () => {
      ignore = true
      window.clearTimeout(fallbackTimer)
      subscription.unsubscribe()
    }
  }, [isLoginRoute, router])

  if (isLoginRoute) {
    return <>{children}</>
  }

  if (!checked) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Verificando sesion...
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Redirigiendo al login...
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
