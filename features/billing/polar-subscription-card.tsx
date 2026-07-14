"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLinkIcon, Loader2Icon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { NAVIGATION_SCOPE_ORG_QUERY_KEY } from "@/lib/navigation/constants"
import { cn } from "@/lib/utils"

type PlanTier = "free" | "pro" | "premium"

type CheckoutResponse = {
  checkoutUrl?: string
  detail?: string
  error?: string
}

function resolveCheckoutErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const typedPayload = payload as CheckoutResponse
  const detail = typedPayload.detail?.trim()
  if (detail) {
    return detail
  }

  const error = typedPayload.error?.trim()
  return error && error.length > 0 ? error : null
}

export function PolarSubscriptionAction(input: {
  organizationId: string
  planTier: PlanTier
  subscriptionStatus: string
  disabled: boolean
  premiumContactHref: string
  buttonClassName?: string
  contactLabel?: string
  disabledLabel?: string
}) {
  const [isCheckoutLoading, setIsCheckoutLoading] = React.useState(false)
  const [checkoutErrorMessage, setCheckoutErrorMessage] = React.useState<string | null>(
    null,
  )
  const portalHref = `/api/subscription/portal?${new URLSearchParams({
    [NAVIGATION_SCOPE_ORG_QUERY_KEY]: input.organizationId,
  }).toString()}`
  const isActivePro =
    input.planTier === "pro" && input.subscriptionStatus.toLowerCase() === "active"

  async function handleCheckoutClick(): Promise<void> {
    setIsCheckoutLoading(true)
    setCheckoutErrorMessage(null)

    try {
      const response = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: input.organizationId,
        }),
      })
      const payload = (await response.json().catch(() => null)) as unknown

      if (!response.ok && response.status !== 202) {
        const errorMessage = resolveCheckoutErrorMessage(payload)
        throw new Error(errorMessage ?? "Could not initialize Polar checkout.")
      }

      if (!payload || typeof payload !== "object" || !("checkoutUrl" in payload)) {
        throw new Error("Polar checkout did not return a checkout URL.")
      }

      const checkoutUrl = (payload as CheckoutResponse).checkoutUrl
      if (!checkoutUrl) {
        throw new Error("Polar checkout did not return a checkout URL.")
      }

      window.location.assign(checkoutUrl)
    } catch (error) {
      setCheckoutErrorMessage(
        error instanceof Error ? error.message : "Could not initialize Polar checkout.",
      )
      setIsCheckoutLoading(false)
    }
  }

  if (input.planTier === "premium") {
    return (
      <Link
        href={input.premiumContactHref}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          input.buttonClassName,
        )}
      >
        {input.contactLabel ?? "Contact us"}
      </Link>
    )
  }

  if (isActivePro) {
    return (
      input.disabled ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled
          className={input.buttonClassName}
        >
          <ExternalLinkIcon className="size-4" />
          Manage in Polar
        </Button>
      ) : (
        <Link
          href={portalHref}
          className={cn(
            buttonVariants({
              variant: "outline",
              size: "lg",
            }),
            input.buttonClassName,
          )}
        >
          <ExternalLinkIcon className="size-4" />
          Manage in Polar
        </Link>
      )
    )
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="lg"
        onClick={() => void handleCheckoutClick()}
        disabled={input.disabled || isCheckoutLoading}
        className={input.buttonClassName}
      >
        {isCheckoutLoading ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <ExternalLinkIcon className="size-4" />
        )}
        Upgrade to Pro
      </Button>
      {input.disabled ? (
        <p className="text-xs text-muted-foreground">
          {input.disabledLabel ??
            "You need org-admin permissions to change the subscription."}
        </p>
      ) : null}
      {checkoutErrorMessage ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {checkoutErrorMessage}
        </p>
      ) : null}
    </div>
  )
}

export function PolarSubscriptionCard(input: {
  organizationId: string
  planTier: PlanTier
  subscriptionStatus: string
  disabled: boolean
  premiumContactHref: string
}) {
  const isActivePro =
    input.planTier === "pro" && input.subscriptionStatus.toLowerCase() === "active"

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">
          {isActivePro ? "Manage Pro subscription" : "Upgrade to Pro"}
        </h3>
        <p className="text-sm text-muted-foreground">
          Monthly Pro Plan, $120/mo through Polar.
        </p>
      </div>

      <PolarSubscriptionAction {...input} />
    </section>
  )
}
