"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { NAVIGATION_SCOPE_ORG_QUERY_KEY } from "@/lib/navigation/constants"

import { Button } from "@/components/ui/button"

type BillingCycle = "monthly" | "yearly"

type SubscriptionIntentResponse = {
  organizationId: string
  billingCycle: BillingCycle
  paypalPlanId: string
  paypalClientId: string
  returnUrl: string
  cancelUrl: string
}

type SubscriptionIntentErrorResponse = {
  error?: string
  detail?: string
}

type PaypalCreateSubscriptionInput = {
  plan_id: string
  custom_id?: string
  application_context?: {
    return_url?: string
    cancel_url?: string
  }
}

type PaypalButtonsActions = {
  subscription: {
    create: (input: PaypalCreateSubscriptionInput) => Promise<string>
  }
}

type PaypalButtonsCreateData = {
  subscriptionID?: string
}

type PaypalButtonStyle = {
  layout?: "vertical" | "horizontal"
  color?: "gold" | "blue" | "silver" | "white" | "black"
  shape?: "rect" | "pill"
  label?: "paypal" | "subscribe"
  tagline?: boolean
}

type PaypalButtonsOptions = {
  style?: PaypalButtonStyle
  createSubscription: (
    data: Record<string, never>,
    actions: PaypalButtonsActions,
  ) => Promise<string>
  onApprove: (data: PaypalButtonsCreateData) => Promise<void>
  onCancel?: () => void
  onError?: (error: unknown) => void
}

type PaypalButtonsInstance = {
  render: (container: HTMLElement | string) => Promise<void>
  isEligible?: () => boolean
  close?: () => void
}

type PaypalNamespace = {
  Buttons: (options: PaypalButtonsOptions) => PaypalButtonsInstance
}

declare global {
  interface Window {
    paypal?: PaypalNamespace
  }
}

function buildPaypalSdkUrl(clientId: string): string {
  const params = new URLSearchParams({
    "client-id": clientId,
    vault: "true",
    intent: "subscription",
    currency: "USD",
    components: "buttons",
  })

  return `https://www.paypal.com/sdk/js?${params.toString()}`
}

function buildBillingSuccessPath(organizationId: string): string {
  const params = new URLSearchParams({
    status: "payment_updated",
    [NAVIGATION_SCOPE_ORG_QUERY_KEY]: organizationId,
  })

  return `/billing?${params.toString()}`
}

function buildBillingErrorPath(organizationId: string): string {
  const params = new URLSearchParams({
    error: "payment_sync_failed",
    [NAVIGATION_SCOPE_ORG_QUERY_KEY]: organizationId,
  })

  return `/billing?${params.toString()}`
}

async function loadPaypalSdk(clientId: string): Promise<void> {
  const existingScript = document.querySelector<HTMLScriptElement>(
    "script[data-paypal-sdk='sailog']",
  )

  if (existingScript) {
    if (existingScript.dataset.clientId === clientId && window.paypal?.Buttons) {
      return
    }

    existingScript.remove()
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    const timeoutId = window.setTimeout(() => {
      reject(new Error("PayPal JS SDK timed out while loading."))
    }, 12000)

    script.src = buildPaypalSdkUrl(clientId)
    script.async = true
    script.dataset.paypalSdk = "sailog"
    script.dataset.clientId = clientId
    script.onload = () => {
      window.clearTimeout(timeoutId)
      resolve()
    }
    script.onerror = () => {
      window.clearTimeout(timeoutId)
      reject(new Error("Could not load PayPal JS SDK."))
    }
    document.head.appendChild(script)
  })

  if (!window.paypal?.Buttons) {
    throw new Error("PayPal SDK loaded, but Buttons is unavailable in this browser.")
  }
}

function resolveSubscriptionIntentErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const typedPayload = payload as SubscriptionIntentErrorResponse
  const detail = typedPayload.detail?.trim()

  if (detail) {
    return detail
  }

  const error = typedPayload.error?.trim()
  return error && error.length > 0 ? error : null
}

export function PaypalSubscriptionCard({
  organizationId,
  disabled,
}: {
  organizationId: string
  disabled: boolean
}) {
  const router = useRouter()
  const buttonContainerRef = React.useRef<HTMLDivElement | null>(null)
  const paypalButtonsRef = React.useRef<PaypalButtonsInstance | null>(null)

  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>("monthly")
  const [intent, setIntent] = React.useState<SubscriptionIntentResponse | null>(null)
  const [isIntentLoading, setIsIntentLoading] = React.useState(false)
  const [sdkErrorMessage, setSdkErrorMessage] = React.useState<string | null>(null)
  const [checkoutErrorMessage, setCheckoutErrorMessage] = React.useState<string | null>(
    null,
  )
  const [isActivating, setIsActivating] = React.useState(false)

  React.useEffect(() => {
    if (disabled) {
      return
    }

    let isSubscribed = true

    const loadIntent = async () => {
      setIsIntentLoading(true)
      setSdkErrorMessage(null)
      setCheckoutErrorMessage(null)

      try {
        const response = await fetch("/api/billing/paypal/subscription-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organizationId,
            billingCycle,
          }),
        })

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as unknown
          const errorMessage = resolveSubscriptionIntentErrorMessage(errorPayload)

          throw new Error(errorMessage ?? "Could not initialize PayPal checkout.")
        }

        const payload = (await response.json()) as SubscriptionIntentResponse

        if (!isSubscribed) {
          return
        }

        setIntent(payload)
      } catch (error) {
        if (!isSubscribed) {
          return
        }

        setIntent(null)
        setCheckoutErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not initialize PayPal checkout.",
        )
      } finally {
        if (isSubscribed) {
          setIsIntentLoading(false)
        }
      }
    }

    loadIntent().catch(() => {
      // Handled in local state in loadIntent.
    })

    return () => {
      isSubscribed = false
    }
  }, [organizationId, billingCycle, disabled])

  React.useEffect(() => {
    if (disabled || !intent || !buttonContainerRef.current) {
      return
    }

    let isCancelled = false

    const renderButtons = async () => {
      try {
        await loadPaypalSdk(intent.paypalClientId)

        if (isCancelled || !buttonContainerRef.current) {
          return
        }

        if (!window.paypal?.Buttons) {
          throw new Error("PayPal Buttons is unavailable after SDK initialization.")
        }

        buttonContainerRef.current.innerHTML = ""

        const paypalButtons = window.paypal.Buttons({
          style: {
            layout: "vertical",
            color: "blue",
            shape: "pill",
            label: "subscribe",
            tagline: false,
          },
          createSubscription: async (_data, actions) => {
            return await actions.subscription.create({
              plan_id: intent.paypalPlanId,
              custom_id: intent.organizationId,
              application_context: {
                return_url: intent.returnUrl,
                cancel_url: intent.cancelUrl,
              },
            })
          },
          onApprove: async (data) => {
            if (!data.subscriptionID) {
              setCheckoutErrorMessage("PayPal did not return a subscription id.")
              return
            }

            setIsActivating(true)
            setCheckoutErrorMessage(null)

            try {
              const activateResponse = await fetch(
                "/api/billing/paypal/subscription-activate",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    organizationId: intent.organizationId,
                    subscriptionId: data.subscriptionID,
                  }),
                },
              )

              if (!activateResponse.ok) {
                throw new Error("Could not activate the subscription after PayPal approval.")
              }

              router.push(buildBillingSuccessPath(intent.organizationId))
              router.refresh()
            } catch (error) {
              setCheckoutErrorMessage(
                error instanceof Error
                  ? error.message
                  : "Could not activate your subscription.",
              )
              router.push(buildBillingErrorPath(intent.organizationId))
              router.refresh()
            } finally {
              setIsActivating(false)
            }
          },
          onCancel: () => {
            setCheckoutErrorMessage(
              "Checkout was cancelled. You can retry when ready.",
            )
          },
          onError: (error) => {
            setCheckoutErrorMessage(
              error instanceof Error
                ? error.message
                : "PayPal checkout failed. Please try again.",
            )
          },
        })

        if (typeof paypalButtons.isEligible === "function" && !paypalButtons.isEligible()) {
          setCheckoutErrorMessage(
            "PayPal did not enable subscription buttons for this account or environment.",
          )
          return
        }

        paypalButtonsRef.current = paypalButtons
        await paypalButtons.render(buttonContainerRef.current)

        const renderedNode = buttonContainerRef.current.querySelector(
          "iframe, button, [data-funding-source]",
        )

        if (!renderedNode) {
          setCheckoutErrorMessage(
            "PayPal checkout initialized but no button was rendered (account/plan eligibility or browser blocking).",
          )
        }
      } catch (error) {
        if (isCancelled) {
          return
        }

        setSdkErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not initialize PayPal SDK.",
        )
      }
    }

    renderButtons().catch(() => {
      // Handled in local state in renderButtons.
    })

    return () => {
      isCancelled = true
      if (paypalButtonsRef.current?.close) {
        paypalButtonsRef.current.close()
      }
      paypalButtonsRef.current = null
    }
  }, [intent, disabled, router])

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">Upgrade to Pro</h3>
        <p className="text-xs text-slate-600">
          Start or recover Pro billing with PayPal subscriptions.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={billingCycle === "monthly" ? "default" : "outline"}
          onClick={() => setBillingCycle("monthly")}
          disabled={disabled || isIntentLoading || isActivating}
        >
          Pro Monthly
        </Button>
        <Button
          type="button"
          variant={billingCycle === "yearly" ? "default" : "outline"}
          onClick={() => setBillingCycle("yearly")}
          disabled={disabled || isIntentLoading || isActivating}
        >
          Pro Yearly
        </Button>
      </div>

      {disabled ? (
        <p className="text-xs text-muted-foreground">
          You need org-admin permissions to change billing.
        </p>
      ) : null}

      {isIntentLoading ? (
        <p className="text-xs text-muted-foreground">Preparing PayPal checkout...</p>
      ) : null}

      {sdkErrorMessage ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {sdkErrorMessage}
        </p>
      ) : null}

      {checkoutErrorMessage ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {checkoutErrorMessage}
        </p>
      ) : null}

      <div ref={buttonContainerRef} className="min-h-[48px]" />
    </section>
  )
}
