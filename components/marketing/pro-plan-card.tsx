import Link from "next/link";
import { CheckIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FEATURES = [
  "Session setup templates for 49er",
  "Aggregated data for team and organization",
  "Reports for every venue per year",
  "Expenses with receipts and PDF reports",
  "Assets for images, files and Vakaros",
  "Vakaros GPS uploads and playback",
  "Notes",
  "Year calendar connected to Google and Outlook",
] as const;

const CONTACT_SALES_EMAIL = "billing@dockout.app";

export function ProPlanCard() {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Pricing plan
        </p>
        <h2 className="text-4xl font-semibold tracking-tight text-foreground">
          Choose your plan
        </h2>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
          Start free and demo our product up to one organization, one team, one venue,
          one camp, and three sessions. Free is hard-capped at session 3 for testing,
          then continue on Pro.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-md border-border bg-background shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-foreground">Free</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Perfect for getting started and to know the tool.
            </p>
            <p className="text-5xl font-semibold tracking-tight text-foreground">$0</p>
            <p className="text-sm text-muted-foreground">Free demo access</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link
              href="/sign-in?mode=register"
              className={buttonVariants({
                variant: "outline",
                className:
                  "w-full border-border bg-background text-foreground hover:bg-muted",
              })}
            >
              Start free
            </Link>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>1 organization</li>
              <li>1 team</li>
              <li>1 venue</li>
              <li>1 camp</li>
              <li>3 sessions (hard block at session 3)</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-md border-primary bg-muted/40 shadow-sm ring-1 ring-primary/20">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-foreground">Pro</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Built for daily team operations and long-term performance tracking.
            </p>
            <p className="text-5xl font-semibold tracking-tight text-foreground">$120</p>
            <p className="text-sm text-muted-foreground">USD + applicable taxes</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <Link
              href="/sign-in?mode=register"
              className={buttonVariants({
                className: "w-full !bg-foreground !text-background hover:!bg-foreground/90",
              })}
            >
              Get started
            </Link>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Features</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md border-border bg-background shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-foreground">Premium</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              For national programs and high-volume operations with manual onboarding.
            </p>
            <p className="text-5xl font-semibold tracking-tight text-foreground">Custom</p>
            <p className="text-sm text-muted-foreground">Contact sales for activation</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link
              href={`mailto:${CONTACT_SALES_EMAIL}?subject=Dock Out Premium plan request`}
              className={buttonVariants({
                variant: "outline",
                className:
                  "w-full border-border bg-background text-foreground hover:bg-muted",
              })}
            >
              Contact sales
            </Link>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>1 organization</li>
              <li>30 teams</li>
              <li>Unlimited venues</li>
              <li>Unlimited camps</li>
              <li>Unlimited sessions</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Prices are shown before applicable taxes.
      </p>
    </section>
  );
}
