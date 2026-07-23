"use client"

import * as React from "react"
import Link from "next/link"

import { GradientCard } from "@/components/shared/gradient-card"
import { Button, buttonVariants } from "@/components/ui/button"
import { ProFeatureUpgradeDialog } from "@/features/billing/free-tier-quota-dialog"
import type { NavigationScope } from "@/lib/navigation/types"

export type TeamExpensesBlockReason = "plan_limit_reached" | "payment_required"

function buildSubscriptionHref(scope: NavigationScope): string {
  const params = new URLSearchParams({
    org: scope.activeOrgId,
    tab: "billing",
  })

  if (scope.activeTeamId) {
    params.set("team", scope.activeTeamId)
  }

  return `/subscription?${params.toString()}`
}

export function TeamExpensesProFeatureGate({
  reason,
  scope,
}: {
  reason: TeamExpensesBlockReason
  scope: NavigationScope
}) {
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = React.useState(
    reason === "plan_limit_reached",
  )
  const subscriptionHref = buildSubscriptionHref(scope)

  if (reason === "payment_required") {
    return (
      <GradientCard className="px-4 py-6" role="alert">
        <h2 className="text-lg font-semibold">Subscription payment required</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your paid plan is inactive. Recover payment in Subscription to continue using
          Expenses.
        </p>
        <Link
          href={subscriptionHref}
          className={buttonVariants({
            variant: "outline",
            className: "mt-4 bg-background",
          })}
        >
          Open Subscription
        </Link>
      </GradientCard>
    )
  }

  return (
    <>
      <GradientCard className="px-4 py-6" role="alert">
        <h2 className="text-lg font-semibold">This is a Pro feature</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Upgrade to Pro to unlock team Expenses, receipt attachments, currency
          conversion, and PDF reports.
        </p>
        <Button
          type="button"
          className="mt-4"
          onClick={() => setIsUpgradeDialogOpen(true)}
        >
          Upgrade to Pro
        </Button>
      </GradientCard>
      <ProFeatureUpgradeDialog
        organizationId={scope.activeOrgId}
        teamId={scope.activeTeamId}
        open={isUpgradeDialogOpen}
        onOpenChange={setIsUpgradeDialogOpen}
        description="Expenses are available on Pro. Upgrade to track team spending, attach receipts, convert currencies, and export PDF reports."
      />
    </>
  )
}
