import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleMinusIcon,
  MailIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CONTACT_SALES_EMAIL = "juanbadino@gmail.com";

type PlanLimit = {
  label: string;
  value: string;
};

type PlanFeature = {
  label: string;
  included: boolean;
};

type MarketingPlan = {
  title: string;
  description: string;
  price: string;
  period: string;
  actionLabel: string;
  actionHref: string;
  actionIcon: "arrow" | "mail";
  featured?: boolean;
  limits: PlanLimit[];
  features: PlanFeature[];
};

const SHARED_FEATURES = [
  { label: "Google/Outlook Calendar Export", included: true },
  { label: "Notes", included: true },
  { label: "Reports", included: true },
  { label: "Assessments", included: true },
] satisfies PlanFeature[];

const MARKETING_PLANS = [
  {
    title: "Free",
    description: "For first setup, demos, and small tests.",
    price: "$0",
    period: "/ forever",
    actionLabel: "Start free",
    actionHref: "/sign-in?mode=register",
    actionIcon: "arrow",
    limits: [
      { label: "Storage", value: "No storage" },
      { label: "Teams", value: "1 team" },
      { label: "Venues", value: "1 venue" },
      { label: "Sessions", value: "3 sessions" },
    ],
    features: [
      { label: "Gear usage tracking with thresholds", included: true },
      { label: "No Vakaros data upload", included: false },
      { label: "No Expenses", included: false },
      { label: "No Assets", included: false },
      ...SHARED_FEATURES,
    ],
  },
  {
    title: "Pro",
    description: "For active sailing programs running daily operations.",
    price: "$120",
    period: "/ per month",
    actionLabel: "Get started",
    actionHref: "/sign-in?mode=register",
    actionIcon: "arrow",
    featured: true,
    limits: [
      { label: "Storage", value: "50 GB" },
      { label: "Teams", value: "3 teams" },
      { label: "Venues", value: "Unlimited venues" },
      { label: "Sessions", value: "Unlimited sessions" },
    ],
    features: [
      { label: "Expenses", included: true },
      { label: "Assets", included: true },
      { label: "Gear usage tracking with thresholds", included: true },
      { label: "Vakaros upload within storage quota", included: true },
      ...SHARED_FEATURES,
    ],
  },
  {
    title: "Premium",
    description: "Manual plan for larger organizations.",
    price: "Custom",
    period: "/ contact us",
    actionLabel: "Contact sales",
    actionHref: `mailto:${CONTACT_SALES_EMAIL}?subject=Dock Out Premium plan request`,
    actionIcon: "mail",
    limits: [
      { label: "Storage", value: "100 GB" },
      { label: "Teams", value: "Unlimited teams" },
      { label: "Venues", value: "Unlimited venues" },
      { label: "Sessions", value: "Unlimited sessions" },
    ],
    features: [
      { label: "Expenses", included: true },
      { label: "Assets", included: true },
      { label: "Gear usage tracking with thresholds", included: true },
      { label: "Vakaros upload within plan storage", included: true },
      ...SHARED_FEATURES,
    ],
  },
] satisfies MarketingPlan[];

function PlanFeatureIcon(input: { included: boolean }) {
  if (input.included) {
    return <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />;
  }

  return <CircleMinusIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
}

function PlanCard(input: { plan: MarketingPlan }) {
  const ActionIcon = input.plan.actionIcon === "mail" ? MailIcon : ArrowRightIcon;

  return (
    <Card
      className={cn(
        "flex h-full min-h-[40rem] rounded-md border-border bg-background shadow-sm",
        input.plan.featured
          ? "border-primary bg-muted/40 ring-1 ring-primary/20"
          : null,
      )}
    >
      <CardHeader className="space-y-5">
        <div className="flex min-h-8 items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-2xl text-foreground">
              {input.plan.title}
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {input.plan.description}
            </p>
          </div>
          {input.plan.featured ? (
            <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              Recommended
            </span>
          ) : null}
        </div>

        <div className="flex min-h-14 items-end gap-2">
          <p className="text-5xl font-semibold text-foreground">{input.plan.price}</p>
          <p className="pb-1.5 text-sm text-muted-foreground">{input.plan.period}</p>
        </div>

        <Link
          href={input.plan.actionHref}
          className={buttonVariants({
            variant: input.plan.featured ? "default" : "outline",
            size: "lg",
            className: cn(
              "h-11 w-full rounded-md",
              input.plan.featured
                ? "!bg-foreground !text-background hover:!bg-foreground/90"
                : "border-border bg-background text-foreground hover:bg-muted",
            ),
          })}
        >
          <ActionIcon data-icon="inline-start" className="size-4" />
          {input.plan.actionLabel}
        </Link>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5">
        <dl className="divide-y divide-border border-y border-border text-sm">
          {input.plan.limits.map((limit) => (
            <div
              key={limit.label}
              className="grid grid-cols-[6.5rem_1fr] gap-3 py-3"
            >
              <dt className="text-muted-foreground">{limit.label}</dt>
              <dd className="font-medium text-foreground">{limit.value}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Features</p>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {input.plan.features.map((feature) => (
              <li key={feature.label} className="flex items-start gap-2.5">
                <PlanFeatureIcon included={feature.included} />
                <span>{feature.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProPlanCard() {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Pricing plan
        </p>
        <h2 className="text-4xl font-semibold text-foreground">
          Choose your plan
        </h2>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
          Start free for a controlled demo, then move to Pro when storage,
          Vakaros uploads, Expenses, and Assets become part of daily operations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {MARKETING_PLANS.map((plan) => (
          <PlanCard key={plan.title} plan={plan} />
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Prices are shown before applicable taxes.
      </p>
    </section>
  );
}
