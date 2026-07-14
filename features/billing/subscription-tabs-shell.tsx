"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type SubscriptionTab = "billing" | "invoice"

export function SubscriptionTabsShell(input: {
  selectedTab: SubscriptionTab
  billingHref: string
  invoiceHref: string
  billingFallback: React.ReactNode
  invoiceFallback: React.ReactNode
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [pendingTab, setPendingTab] = React.useState<SubscriptionTab | null>(null)
  const visibleTab = pendingTab ?? input.selectedTab
  const showFallback = pendingTab !== null && pendingTab !== input.selectedTab

  React.useEffect(() => {
    setPendingTab(null)
  }, [input.selectedTab])

  React.useEffect(() => {
    if (!pendingTab) {
      return
    }

    const timeout = window.setTimeout(() => {
      setPendingTab(null)
    }, 5000)

    return () => window.clearTimeout(timeout)
  }, [pendingTab])

  function navigate(tab: SubscriptionTab, href: string): void {
    if (tab === input.selectedTab && pendingTab === null) {
      return
    }

    setPendingTab(tab)
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={visibleTab}
        onValueChange={(value) => {
          const tab = value === "invoice" ? "invoice" : "billing"
          navigate(tab, tab === "invoice" ? input.invoiceHref : input.billingHref)
        }}
        className="w-full min-w-0 md:w-auto"
      >
        <div className="flex h-11 w-full max-w-full items-center rounded-lg bg-muted p-[3px] text-muted-foreground md:hidden">
          <TabsList className="h-full min-w-0 flex-1 rounded-md bg-transparent p-0 group-data-horizontal/tabs:h-full">
            <TabsTrigger
              value="billing"
              disabled={isPending}
              className="min-w-0 basis-0 px-2"
            >
              Billing
            </TabsTrigger>
            <TabsTrigger
              value="invoice"
              disabled={isPending}
              className="min-w-0 basis-0 px-2"
            >
              Invoice
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsList className="hidden h-10 w-56 md:inline-flex">
          <TabsTrigger value="billing" disabled={isPending} className="min-w-0 basis-0">
            Billing
          </TabsTrigger>
          <TabsTrigger value="invoice" disabled={isPending} className="min-w-0 basis-0">
            Invoice
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {showFallback
        ? visibleTab === "billing"
          ? input.billingFallback
          : input.invoiceFallback
        : input.children}
    </div>
  )
}
