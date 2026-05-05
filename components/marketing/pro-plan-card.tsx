"use client";

import * as React from "react";
import Link from "next/link";
import { CheckIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BillingCycle = "monthly" | "yearly";

const PLAN_DETAILS: Record<
  BillingCycle,
  {
    title: string;
    amount: string;
    description: string;
    savings?: string;
  }
> = {
  monthly: {
    title: "Monthly",
    amount: "120",
    description: "USD per month",
  },
  yearly: {
    title: "Yearly",
    amount: "100",
    description: "USD per month · billed yearly",
    savings: "Save USD 20 per month with yearly billing",
  },
};

const FEATURES = [
  "Session setup templates for 49er",
  "Aggregated data for team and organization",
  "Reports for every venue per year",
  "Notes",
  "Year calendar connected to Google and Outlook",
] as const;

const CONTACT_SALES_EMAIL = "billing@sailog.app";

export function ProPlanCard() {
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>("yearly");
  const details = PLAN_DETAILS[billingCycle];

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pricing Plan</p>
        <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Choose your plan</h2>
        <p className="mx-auto max-w-2xl text-sm text-slate-600">
          Start free and demo our product up to one organization, one team, one venue,
          one camp, and three sessions. Free is hard-capped at session 3 for testing,
          then continue on Pro.
        </p>
      </div>

      <div className="mx-auto inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
        {(["monthly", "yearly"] as BillingCycle[]).map((cycle) => (
          <button
            key={cycle}
            type="button"
            onClick={() => setBillingCycle(cycle)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-medium transition-colors",
              billingCycle === cycle
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
            aria-pressed={billingCycle === cycle}
          >
            {PLAN_DETAILS[cycle].title}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Free</CardTitle>
            <p className="text-sm text-slate-600">
              Perfect for getting started and to know the tool.
            </p>
            <p className="text-5xl font-semibold tracking-tight text-slate-900">$0</p>
            <p className="text-sm text-slate-600">Free demo access</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link
              href="/sign-in?mode=register"
              className={buttonVariants({
                variant: "outline",
                className:
                  "w-full border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
              })}
            >
              Start free
            </Link>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>1 organization</li>
              <li>1 team</li>
              <li>1 venue</li>
              <li>1 camp</li>
              <li>3 sessions (hard block at session 3)</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Pro</CardTitle>
            <p className="text-sm text-slate-600">
              Built for daily team operations and long-term performance tracking.
            </p>
            <p className="text-5xl font-semibold tracking-tight text-slate-900">
              ${details.amount}
            </p>
            <p className="text-sm text-slate-600">{details.description}</p>
            {details.savings ? (
              <p className="text-sm font-medium text-emerald-700">{details.savings}</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6">
            <Link
              href="/sign-in?mode=register"
              className={buttonVariants({
                className: "w-full bg-blue-700 text-white hover:bg-blue-600",
              })}
            >
              Get started
            </Link>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">Features</p>
              <ul className="space-y-2 text-sm text-slate-700">
                {FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Olympic</CardTitle>
            <p className="text-sm text-slate-600">
              For national programs and high-volume operations with manual onboarding.
            </p>
            <p className="text-5xl font-semibold tracking-tight text-slate-900">Custom</p>
            <p className="text-sm text-slate-600">Contact sales for activation</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link
              href={`mailto:${CONTACT_SALES_EMAIL}?subject=Sailog Olympic plan request`}
              className={buttonVariants({
                variant: "outline",
                className:
                  "w-full border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
              })}
            >
              Contact sales
            </Link>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>1 organization</li>
              <li>30 teams</li>
              <li>Unlimited venues</li>
              <li>Unlimited camps</li>
              <li>Unlimited sessions</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
