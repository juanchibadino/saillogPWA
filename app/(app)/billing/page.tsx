import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PaypalSubscriptionCard } from "@/features/billing/paypal-subscription-card"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { resolveOrganizationBillingSnapshot } from "@/lib/billing/entitlements"
import { getSingleSearchParamValue, resolveNavigationScope } from "@/lib/navigation/scope"

const CONTACT_SALES_EMAIL = "billing@sailog.app"

type BillingSearchParams = Promise<Record<string, string | string[] | undefined>>

function formatLimit(limit: number | null): string {
  if (limit === null) {
    return "Unlimited"
  }

  return String(limit)
}

function formatPlanTier(planTier: "free" | "pro" | "olympic"): string {
  if (planTier === "free") {
    return "Free"
  }

  if (planTier === "pro") {
    return "Pro"
  }

  return "Olympic"
}

function formatBillingCycle(cycle: "none" | "monthly" | "yearly"): string {
  if (cycle === "monthly") {
    return "Monthly"
  }

  if (cycle === "yearly") {
    return "Yearly"
  }

  return "No recurring cycle"
}

function formatSubscriptionStatus(
  status:
    | "active"
    | "approval_pending"
    | "approved"
    | "suspended"
    | "cancelled"
    | "expired"
    | "payment_failed",
): string {
  if (status === "approval_pending") {
    return "Approval Pending"
  }

  if (status === "payment_failed") {
    return "Payment Failed"
  }

  return status.charAt(0).toUpperCase() + status.slice(1)
}

function getStatusMessage(status: string | undefined): string | null {
  if (status === "payment_updated") {
    return "Billing details updated successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "checkout_cancelled") {
    return "Checkout was cancelled before approval."
  }

  if (error === "payment_sync_failed") {
    return "Could not sync your PayPal subscription. Please retry from this page."
  }

  return null
}

function buildOlympicContactHref(organizationName: string): string {
  const subject = encodeURIComponent(
    `Sailog Olympic plan request - ${organizationName}`,
  )
  const body = encodeURIComponent(
    `Hello Sailog team,%0D%0A%0D%0AWe want to activate Olympic billing for ${organizationName}.`,
  )

  return `mailto:${CONTACT_SALES_EMAIL}?subject=${subject}&body=${body}`
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: BillingSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams
  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)

  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)

  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Billing unavailable</h2>
        <p className="mt-2 text-sm text-amber-800">
          Billing requires an active organization context.
        </p>
      </section>
    )
  }

  const scope = navigation.scope
  const activeOrganization =
    navigation.catalog.organizations.find(
      (organization) => organization.id === scope.activeOrgId,
    ) ?? null

  if (!activeOrganization) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">
          Organization context unavailable
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          Could not resolve the active organization from your current scope.
        </p>
      </section>
    )
  }

  const canManageBilling = canManageOrganizationOperations(context, activeOrganization.id)
  const billingSnapshot = await resolveOrganizationBillingSnapshot(activeOrganization.id)

  const olympicContactHref = buildOlympicContactHref(activeOrganization.name)

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Organization billing for <strong>{activeOrganization.name}</strong>.
        </p>
      </header>

      {statusMessage ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {statusMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </p>
      ) : null}

      {!canManageBilling ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Read-only access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can view billing details, but only organization admins and super admins can
            change billing.
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardDescription>Current plan</CardDescription>
            <CardTitle className="text-2xl">
              {formatPlanTier(billingSnapshot.subscription.planTier)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Status:</span>{" "}
              {formatSubscriptionStatus(billingSnapshot.subscription.status)}
            </p>
            <p>
              <span className="text-muted-foreground">Cycle:</span>{" "}
              {formatBillingCycle(billingSnapshot.subscription.billingCycle)}
            </p>
            <p>
              <span className="text-muted-foreground">Pro support:</span>{" "}
              Monthly or yearly via PayPal
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardDescription>Usage vs limits</CardDescription>
            <CardTitle>Current organization usage</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Teams</p>
              <p className="mt-1 text-sm font-medium">
                {billingSnapshot.usage.teams} / {formatLimit(billingSnapshot.limits.teams)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Venues</p>
              <p className="mt-1 text-sm font-medium">
                {billingSnapshot.usage.venues} / {formatLimit(billingSnapshot.limits.venues)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Camps</p>
              <p className="mt-1 text-sm font-medium">
                {billingSnapshot.usage.camps} / {formatLimit(billingSnapshot.limits.camps)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sessions</p>
              <p className="mt-1 text-sm font-medium">
                {billingSnapshot.usage.sessions} / {formatLimit(billingSnapshot.limits.sessions)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PaypalSubscriptionCard
          organizationId={activeOrganization.id}
          disabled={!canManageBilling}
        />

        <Card>
          <CardHeader>
            <CardTitle>Olympic</CardTitle>
            <CardDescription>
              Olympic includes up to 30 teams with unlimited venues, camps, and sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Olympic is a contact-sales flow in MVP. Use manual activation with the Sailog
              billing team.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={olympicContactHref}
                className={buttonVariants({
                  variant: "outline",
                })}
              >
                Contact sales
              </Link>
              <Link
                href="/"
                className={buttonVariants({
                  variant: "ghost",
                })}
              >
                See plan copy
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
