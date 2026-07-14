"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import {
  SUBSCRIPTION_PLAN_UPDATED_EVENT,
  type SubscriptionPlanUpdatedEventDetail,
} from "@/features/billing/subscription-plan-events"

type CheckoutSyncResponse = {
  synced: boolean
  organizationId: string
  planTier: "pro" | null
  reason:
    | "checkout_not_completed"
    | "missing_subscription"
    | "product_mismatch"
    | null
}

function dispatchSubscriptionPlanUpdated(detail: SubscriptionPlanUpdatedEventDetail) {
  window.dispatchEvent(
    new CustomEvent<SubscriptionPlanUpdatedEventDetail>(
      SUBSCRIPTION_PLAN_UPDATED_EVENT,
      { detail },
    ),
  )
}

export function SubscriptionFeedback(input: {
  organizationId: string
  statusMessage: string | null
  errorMessage: string | null
  checkoutId: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handledFeedbackKeyRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const status = searchParams.get("status")
    const error = searchParams.get("error")
    const checkoutId = input.checkoutId ?? searchParams.get("checkout_id")
    const feedbackKey = `${pathname}:${searchParams.toString()}`

    if (handledFeedbackKeyRef.current === feedbackKey) {
      return
    }

    const hasStatusFeedback = Boolean(input.statusMessage && status)
    const hasErrorFeedback = Boolean(input.errorMessage && error)

    if (!hasStatusFeedback && !hasErrorFeedback) {
      return
    }

    handledFeedbackKeyRef.current = feedbackKey

    const cleanupUrl = () => {
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.delete("status")
      nextParams.delete("error")
      nextParams.delete("checkout_id")

      const nextSearch = nextParams.toString()
      const nextUrl = nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname
      router.replace(nextUrl, { scroll: false })
    }

    if (hasErrorFeedback && input.errorMessage) {
      toast.error(input.errorMessage, {
        id: `subscription-feedback:${pathname}:error:${error}`,
      })
      cleanupUrl()
      return
    }

    if (!input.statusMessage || !status) {
      cleanupUrl()
      return
    }

    if (status !== "subscription_updated" || !checkoutId) {
      toast.success(input.statusMessage, {
        id: `subscription-feedback:${pathname}:status:${status}`,
      })
      cleanupUrl()
      return
    }

    const toastId = `subscription-feedback:${input.organizationId}:${checkoutId}`
    toast.loading("Updating subscription...", { id: toastId })

    const syncCheckout = async () => {
      try {
        const response = await fetch("/api/subscription/checkout/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organizationId: input.organizationId,
            checkoutId,
          }),
        })

        if (!response.ok) {
          throw new Error("Could not sync subscription.")
        }

        const payload = (await response.json()) as CheckoutSyncResponse

        if (payload.synced && payload.planTier) {
          dispatchSubscriptionPlanUpdated({
            organizationId: input.organizationId,
            planTier: payload.planTier,
          })
          toast.success(input.statusMessage, { id: toastId })
          router.refresh()
          return
        }

        toast.message("Checkout received. Waiting for Polar to finish syncing.", {
          id: toastId,
        })
        router.refresh()
      } catch {
        toast.error(
          "Checkout completed, but subscription sync is still pending. Check Polar webhook delivery.",
          { id: toastId },
        )
      } finally {
        cleanupUrl()
      }
    }

    void syncCheckout()
  }, [
    input.checkoutId,
    input.errorMessage,
    input.organizationId,
    input.statusMessage,
    pathname,
    router,
    searchParams,
  ])

  return null
}
