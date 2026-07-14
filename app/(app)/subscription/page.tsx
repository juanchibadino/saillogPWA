import { Suspense, type ReactNode } from "react"
import Link from "next/link"
import { CheckCircle2Icon, ExternalLinkIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GradientCard } from "@/components/shared/gradient-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ManageSubscriptionLink,
  PolarSubscriptionAction,
} from "@/features/billing/polar-subscription-card"
import { SubscriptionFeedback } from "@/features/billing/subscription-feedback"
import {
  SubscriptionBillingSkeleton,
  SubscriptionInvoiceSkeleton,
} from "@/features/billing/subscription-skeletons"
import { SubscriptionTabsShell } from "@/features/billing/subscription-tabs-shell"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { canManageOrganizationOperations } from "@/lib/auth/capabilities"
import { requireOrganizationRouteAccess } from "@/lib/auth/organization-route-guard"
import {
  getPolarLatestPaymentForOrganization,
  listPolarInvoicesForOrganization,
  type PolarLatestPaymentSummary,
  type PolarInvoiceSummary,
} from "@/lib/billing/polar"
import {
  resolveOrganizationBillingSnapshot,
} from "@/lib/billing/entitlements"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"
import { getSingleSearchParamValue } from "@/lib/navigation/scope"
import { cn } from "@/lib/utils"

const CONTACT_SALES_EMAIL = "billing@dockout.app"

type SubscriptionSearchParams = Promise<Record<string, string | string[] | undefined>>
type SubscriptionTab = "billing" | "invoice"
type SubscriptionBillingSnapshot = Awaited<
  ReturnType<typeof resolveOrganizationBillingSnapshot>
>

function resolveSubscriptionTab(value: string | undefined): SubscriptionTab {
  return value === "invoice" ? "invoice" : "billing"
}

function formatLimit(limit: number | null): string {
  return limit === null ? "Unlimited" : String(limit)
}

function formatPlanTier(planTier: "free" | "pro" | "premium"): string {
  if (planTier === "free") {
    return "Free"
  }

  if (planTier === "pro") {
    return "Pro"
  }

  return "Premium"
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function getStatusMessage(status: string | undefined): string | null {
  if (status === "subscription_updated") {
    return "Subscription updated successfully."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "forbidden") {
    return "You do not have permission to manage this subscription."
  }

  if (error === "portal_unavailable") {
    return "Could not open the Polar customer portal. Try again in a few seconds."
  }

  if (error === "invoice_unavailable") {
    return "Could not open that invoice. Try again in a few seconds."
  }

  return null
}

function buildPremiumContactHref(organizationName: string): string {
  const subject = encodeURIComponent(
    `Dock Out Premium plan request - ${organizationName}`,
  )
  const body = encodeURIComponent(
    `Hello Dock Out team,\n\nWe want to activate Premium for ${organizationName}.`,
  )

  return `mailto:${CONTACT_SALES_EMAIL}?subject=${subject}&body=${body}`
}

function buildSubscriptionHref(input: {
  tab: SubscriptionTab
  organizationId: string
  teamId: string | null
}): string {
  const params = new URLSearchParams({
    [NAVIGATION_SCOPE_ORG_QUERY_KEY]: input.organizationId,
    tab: input.tab,
  })

  if (input.teamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.teamId)
  }

  return `/subscription?${params.toString()}`
}

function buildSubscriptionPortalHref(organizationId: string): string {
  return `/api/subscription/portal?${new URLSearchParams({
    [NAVIGATION_SCOPE_ORG_QUERY_KEY]: organizationId,
  }).toString()}`
}

function buildInvoiceOpenHref(input: {
  invoiceId: string
  organizationId: string
}): string {
  return `/api/subscription/invoices/${encodeURIComponent(
    input.invoiceId,
  )}?${new URLSearchParams({
    [NAVIGATION_SCOPE_ORG_QUERY_KEY]: input.organizationId,
  }).toString()}`
}

function UsageTile(input: { label: string; usage: number; limit: number | null }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{input.label}</p>
      <p className="mt-2 text-base font-semibold">
        {input.usage} / {formatLimit(input.limit)}
      </p>
    </div>
  )
}

function PlanActionButton(input: {
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled
      className="h-10 w-full rounded-lg"
    >
      {input.children}
    </Button>
  )
}

function PlanCard(input: {
  title: string
  description: string
  price: string
  period: string
  features: string[]
  isCurrent: boolean
  action: ReactNode
}) {
  return (
    <GradientCard
      className={cn(
        "flex min-h-[27rem] flex-col rounded-lg border p-5 shadow-sm sm:p-6",
        input.isCurrent ? "border-white/50" : "border-border",
      )}
    >
      <div className="flex min-h-7 items-start justify-between gap-3">
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold tracking-tight">{input.title}</h2>
          <p className="text-sm text-muted-foreground">{input.description}</p>
        </div>
        {input.isCurrent ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            Current
          </span>
        ) : null}
      </div>

      <div className="mt-6 flex items-end gap-2">
        <p className="text-4xl font-semibold tracking-normal sm:text-5xl">{input.price}</p>
        <p className="pb-1.5 text-sm text-muted-foreground">
          {input.period}
        </p>
      </div>

      <div className="mt-5">{input.action}</div>

      <div className="mt-5 h-px bg-border" />

      <div className="mt-5 space-y-4">
        <h3 className="text-base font-semibold">Features</h3>
        <ul className="space-y-2.5 text-sm">
          {input.features.map((feature) => (
            <li key={feature} className="flex gap-2.5">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </GradientCard>
  )
}

function PlanCards(input: {
  billingSnapshot: SubscriptionBillingSnapshot
  canManageSubscription: boolean
  organizationId: string
  premiumContactHref: string
}) {
  const currentTier = input.billingSnapshot.subscription.planTier
  const subscriptionStatus = input.billingSnapshot.subscription.status
  const actionClassName = "h-10 w-full rounded-lg"

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <PlanCard
        title="Free"
        description="For first setup and small tests."
        price="$0"
        period="/ forever"
        isCurrent={currentTier === "free"}
        features={[
          "1 team",
          "1 venue",
          "1 camp",
          "3 sessions",
          "No image uploads",
          "No analytics file uploads",
        ]}
        action={
          <PlanActionButton>
            {currentTier === "free" ? "Current plan" : "Free tier"}
          </PlanActionButton>
        }
      />

      <PlanCard
        title="Pro"
        description="For active sailing programs."
        price="$120"
        period="/ per month"
        isCurrent={currentTier === "pro"}
        features={[
          "3 teams",
          "Unlimited venues",
          "Unlimited camps",
          "Unlimited sessions",
          "Image uploads",
          "Analytics file uploads",
        ]}
        action={
          currentTier === "premium" ? (
            <PlanActionButton>Included in Premium</PlanActionButton>
          ) : (
            <PolarSubscriptionAction
              organizationId={input.organizationId}
              planTier={currentTier}
              subscriptionStatus={subscriptionStatus}
              disabled={!input.canManageSubscription}
              premiumContactHref={input.premiumContactHref}
              buttonClassName={actionClassName}
            />
          )
        }
      />

      <PlanCard
        title="Premium"
        description="Manual plan for larger organizations."
        price="Custom"
        period="/ contact us"
        isCurrent={currentTier === "premium"}
        features={[
          "30 teams",
          "Unlimited venues",
          "Unlimited camps",
          "Unlimited sessions",
          "Image and analytics uploads",
          "Manual activation",
        ]}
        action={
          currentTier === "premium" ? (
            <PlanActionButton>Current plan</PlanActionButton>
          ) : (
            <Link
              href={input.premiumContactHref}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                actionClassName,
              )}
            >
              Contact us
            </Link>
          )
        }
      />
    </div>
  )
}

function QuotaPanel(input: {
  billingSnapshot: SubscriptionBillingSnapshot
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Actual quota</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          <UsageTile
            label="Teams"
            usage={input.billingSnapshot.usage.teams}
            limit={input.billingSnapshot.limits.teams}
          />
          <UsageTile
            label="Venues"
            usage={input.billingSnapshot.usage.venues}
            limit={input.billingSnapshot.limits.venues}
          />
          <UsageTile
            label="Camps"
            usage={input.billingSnapshot.usage.camps}
            limit={input.billingSnapshot.limits.camps}
          />
          <UsageTile
            label="Sessions"
            usage={input.billingSnapshot.usage.sessions}
            limit={input.billingSnapshot.limits.sessions}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function BillingCycleItem(input: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-lg border bg-background p-3", input.className)}>
      <p className="text-xs font-medium uppercase text-muted-foreground">
        {input.label}
      </p>
      <div className="mt-2 text-sm font-medium">{input.value}</div>
    </div>
  )
}

function formatDateRange(input: {
  startsAt: string | null
  endsAt: string | null
}): string {
  if (!input.startsAt || !input.endsAt) {
    return "No active billing period"
  }

  return `${formatDate(input.startsAt)} - ${formatDate(input.endsAt)}`
}

function BillingCycleCard(input: {
  billingSnapshot: SubscriptionBillingSnapshot
  latestPayment: PolarLatestPaymentSummary | null
  latestPaymentErrorMessage: string | null
  organizationId: string
  canManageSubscription: boolean
}) {
  const subscription = input.billingSnapshot.subscription
  const hasPolarSubscription =
    subscription.planTier === "pro" &&
    subscription.status === "active" &&
    Boolean(subscription.polarSubscriptionId)
  const portalHref = buildSubscriptionPortalHref(input.organizationId)
  const lastPaymentLabel = input.latestPayment
    ? `${input.latestPayment.amountLabel} on ${formatDate(input.latestPayment.paidAt)}`
    : "No payment recorded"
  const planSummaryLabel = `${formatPlanTier(subscription.planTier)} plan · ${formatSubscriptionStatus(
    subscription.status,
  )} · ${formatBillingCycle(subscription.billingCycle)}`
  const manageSubscriptionAction = hasPolarSubscription && input.canManageSubscription ? (
    <ManageSubscriptionLink
      href={portalHref}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    />
  ) : (
    <Button type="button" variant="outline" size="sm" disabled>
      {hasPolarSubscription ? "Manage subscription" : "No active subscription"}
    </Button>
  )
  const mobileManageSubscriptionAction =
    hasPolarSubscription && input.canManageSubscription ? (
      <ManageSubscriptionLink
        href={portalHref}
        className={cn(
          buttonVariants({ variant: "outline", size: "default" }),
          "!h-11 w-full",
        )}
      />
    ) : (
      <Button
        type="button"
        variant="outline"
        size="default"
        disabled
        className="!h-11 w-full"
      >
        {hasPolarSubscription ? "Manage subscription" : "No active subscription"}
      </Button>
  )

  return (
    <Card className="h-full">
      <CardHeader className="gap-3">
        <CardTitle className="text-base">Billing Cycle</CardTitle>
        <CardAction className="hidden md:block">
          {manageSubscriptionAction}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <BillingCycleItem
            label="Current period"
            value={formatDateRange({
              startsAt: subscription.currentPeriodStartAt,
              endsAt: subscription.currentPeriodEndAt,
            })}
          />
          <BillingCycleItem label="Last payment" value={lastPaymentLabel} />
          <BillingCycleItem
            label="Plan card"
            value={planSummaryLabel}
            className="sm:col-span-2"
          />
        </div>

        {input.latestPaymentErrorMessage ? (
          <p className="text-xs text-muted-foreground">
            {input.latestPaymentErrorMessage}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="pt-0 md:hidden">
        {mobileManageSubscriptionAction}
      </CardFooter>
    </Card>
  )
}

async function SubscriptionBillingContent(input: {
  organizationId: string
  organizationName: string
  canManageSubscription: boolean
}) {
  const billingSnapshot = await resolveOrganizationBillingSnapshot(input.organizationId)
  const premiumContactHref = buildPremiumContactHref(input.organizationName)
  const hasPolarSubscription = Boolean(
    billingSnapshot.subscription.polarSubscriptionId,
  )
  let latestPayment: PolarLatestPaymentSummary | null = null
  let latestPaymentErrorMessage: string | null = null

  if (hasPolarSubscription) {
    try {
      latestPayment = await getPolarLatestPaymentForOrganization(input.organizationId)
    } catch {
      latestPaymentErrorMessage =
        "Could not load the latest payment from Polar."
    }
  }

  return (
    <div className="space-y-6">
      <PlanCards
        billingSnapshot={billingSnapshot}
        canManageSubscription={input.canManageSubscription}
        organizationId={input.organizationId}
        premiumContactHref={premiumContactHref}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <BillingCycleCard
          billingSnapshot={billingSnapshot}
          latestPayment={latestPayment}
          latestPaymentErrorMessage={latestPaymentErrorMessage}
          organizationId={input.organizationId}
          canManageSubscription={input.canManageSubscription}
        />
        <QuotaPanel billingSnapshot={billingSnapshot} />
      </div>
    </div>
  )
}

function InvoiceList(input: {
  invoices: PolarInvoiceSummary[]
  organizationId: string
}) {
  if (input.invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No invoices</CardTitle>
          <CardDescription>
            Polar has no invoices for this organization yet.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {input.invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                <TableCell>{invoice.status}</TableCell>
                <TableCell>{invoice.amountLabel}</TableCell>
                <TableCell className="text-right">
                  <a
                    href={buildInvoiceOpenHref({
                      invoiceId: invoice.id,
                      organizationId: input.organizationId,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <ExternalLinkIcon className="size-4" />
                    Open
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {input.invoices.map((invoice) => (
          <Card key={invoice.id}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">{invoice.invoiceNumber}</CardTitle>
              <CardDescription>{formatDate(invoice.createdAt)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Status</span>
                <span className="text-right">{invoice.status}</span>
                <span className="text-muted-foreground">Amount</span>
                <span className="text-right font-medium">{invoice.amountLabel}</span>
              </div>
              <a
                href={buildInvoiceOpenHref({
                  invoiceId: invoice.id,
                  organizationId: input.organizationId,
                })}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ExternalLinkIcon className="size-4" />
                Open invoice
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

async function SubscriptionInvoiceContent(input: { organizationId: string }) {
  let invoices: PolarInvoiceSummary[] = []
  let invoiceErrorMessage: string | null = null

  try {
    invoices = await listPolarInvoicesForOrganization(input.organizationId)
  } catch (invoiceError) {
    invoiceErrorMessage =
      invoiceError instanceof Error
        ? invoiceError.message
        : "Could not load invoices from Polar."
  }

  if (invoiceErrorMessage) {
    return (
      <p className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {invoiceErrorMessage}
      </p>
    )
  }

  return <InvoiceList invoices={invoices} organizationId={input.organizationId} />
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: SubscriptionSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams
  const selectedTab = resolveSubscriptionTab(
    getSingleSearchParamValue(resolvedSearchParams.tab),
  )
  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const checkoutId = getSingleSearchParamValue(resolvedSearchParams.checkout_id)
  const statusMessage = getStatusMessage(status)
  const errorMessage = getErrorMessage(error)
  const navigation = await requireOrganizationRouteAccess({
    context,
    searchParams: resolvedSearchParams,
  })

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">
          Subscription unavailable
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          Subscription requires an active organization context.
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

  const canManageSubscription = canManageOrganizationOperations(
    context,
    activeOrganization.id,
  )
  const billingHref = buildSubscriptionHref({
    tab: "billing",
    organizationId: activeOrganization.id,
    teamId: scope.activeTeamId,
  })
  const invoiceHref = buildSubscriptionHref({
    tab: "invoice",
    organizationId: activeOrganization.id,
    teamId: scope.activeTeamId,
  })
  const fallback =
    selectedTab === "invoice" ? (
      <SubscriptionInvoiceSkeleton />
    ) : (
      <SubscriptionBillingSkeleton />
    )

  return (
    <div className="space-y-6">
      <SubscriptionFeedback
        organizationId={activeOrganization.id}
        statusMessage={statusMessage}
        errorMessage={errorMessage}
        checkoutId={checkoutId ?? null}
      />

      <SubscriptionTabsShell
        selectedTab={selectedTab}
        billingHref={billingHref}
        invoiceHref={invoiceHref}
        billingFallback={<SubscriptionBillingSkeleton />}
        invoiceFallback={<SubscriptionInvoiceSkeleton />}
      >
        <Suspense key={`${activeOrganization.id}:${selectedTab}`} fallback={fallback}>
          {selectedTab === "invoice" ? (
            <SubscriptionInvoiceContent organizationId={activeOrganization.id} />
          ) : (
            <SubscriptionBillingContent
              organizationId={activeOrganization.id}
              organizationName={activeOrganization.name}
              canManageSubscription={canManageSubscription}
            />
          )}
        </Suspense>
      </SubscriptionTabsShell>
    </div>
  )
}
