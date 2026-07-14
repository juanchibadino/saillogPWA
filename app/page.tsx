import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ActivityIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  CameraIcon,
  ChartBarIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  CloudSunIcon,
  FileTextIcon,
  MapPinIcon,
  RouteIcon,
  SailboatIcon,
  ShieldCheckIcon,
  TimerIcon,
  UsersIcon,
  WindIcon,
  WavesIcon,
} from "lucide-react";

import {
  LandingThemeShell,
  LandingThemeToggle,
} from "@/components/marketing/landing-theme-shell";
import { ProPlanCard } from "@/components/marketing/pro-plan-card";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentAccessContext } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

type FeatureCard = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const NAV_ITEMS = [
  { label: "Product", href: "#product" },
  { label: "Reports", href: "#reports" },
  { label: "Pricing", href: "#pricing" },
] as const;

const PRODUCT_FEATURES: FeatureCard[] = [
  {
    title: "Session command center",
    description:
      "Log setup, notes, goals, results, media and review context from the same daily workflow.",
    icon: ClipboardListIcon,
  },
  {
    title: "Venue memory",
    description:
      "Keep stable venue history across seasons, camps and sessions instead of rebuilding context every year.",
    icon: MapPinIcon,
  },
  {
    title: "Operational visibility",
    description:
      "See sailing time, session volume and activity trends by team, camp, venue and period.",
    icon: ChartBarIcon,
  },
] as const;

const OPERATIONS = [
  {
    title: "Organization",
    description: "Top-level ownership, membership and reporting.",
  },
  {
    title: "Teams",
    description: "Role-based workspaces for sailors, coaches and crew.",
  },
  {
    title: "Venues",
    description: "Stable sailing locations reused across years.",
  },
  {
    title: "Camps",
    description: "Training blocks tied to the active team venue.",
  },
  {
    title: "Sessions",
    description: "Daily logs with setup, review and performance data.",
  },
] as const;

const WORKFLOW_STEPS = [
  {
    title: "Plan the block",
    description: "Create the venue, camp and calendar context before sailors hit the water.",
    icon: CalendarDaysIcon,
  },
  {
    title: "Run the session",
    description: "Record setup, notes, timing, files and decisions from mobile or desktop.",
    icon: WavesIcon,
  },
  {
    title: "Review the trend",
    description: "Use reports to compare activity by team, camp, venue and season.",
    icon: ActivityIcon,
  },
] as const;

const METRICS = [
  {
    label: "Net time sailed",
    value: "146 h 20 m",
    helper: "Tracked from session timelines.",
  },
  {
    label: "Total sessions",
    value: "84",
    helper: "Recorded in the selected scope.",
  },
  {
    label: "Average water time",
    value: "2 h 14 m",
    helper: "Dock-out to dock-in trend.",
  },
] as const;

const REPORT_FEATURES: FeatureCard[] = [
  {
    title: "Team level data",
    description: "Session history, camp totals, water-time averages and highlights.",
    icon: UsersIcon,
  },
  {
    title: "Organization level data",
    description: "Aggregate activity across teams, venues and operating periods.",
    icon: ShieldCheckIcon,
  },
  {
    title: "Year and venue context",
    description: "Reports stay connected to the same stable venues season after season.",
    icon: RouteIcon,
  },
] as const;

export default async function Home() {
  const context = await getCurrentAccessContext();

  if (context.user) {
    redirect("/post-auth");
  }

  return (
    <LandingThemeShell>
      <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Dock Out home">
            <Image
              src="/Black_49er.svg"
              alt=""
              width={32}
              height={32}
              className="size-8 dark:invert"
              priority
            />
            <span className="text-sm font-semibold tracking-wide text-foreground">Dock Out</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LandingThemeToggle />
            <Link
              href="/sign-in"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className:
                  "border-border bg-background/80 text-foreground hover:bg-muted",
              })}
            >
              Sign in
            </Link>
            <Link
              href="/sign-in?mode=register"
              className={buttonVariants({
                size: "sm",
                className: "!bg-foreground !text-background hover:!bg-foreground/90",
              })}
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <section className="min-h-screen border-b border-border bg-background">
        <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-[0.9fr_1.1fr] md:px-8">
          <div className="max-w-2xl space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Sailing logbook app
            </p>
            <div className="space-y-4">
              <h1 className="text-5xl font-semibold leading-[0.96] tracking-tight text-foreground md:text-7xl">
                Dock Out
              </h1>
              <p className="max-w-2xl text-xl font-medium leading-tight text-foreground md:text-2xl">
                Made by pro sailors for pro sailors.
              </p>
            </div>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Track sessions, training camps, venues, water time, media and reports in one
              simple mobile-first workspace.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-in?mode=register"
                className={buttonVariants({
                  size: "lg",
                  className:
                    "h-11 !bg-foreground px-5 !text-background hover:!bg-foreground/90",
                })}
              >
                Start free
                <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                href="/sign-in"
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className:
                    "h-11 border-border bg-background/80 px-5 text-foreground hover:bg-muted",
                })}
              >
                Sign in
              </Link>
            </div>
          </div>

          <HeroCollage />
        </div>
      </section>

      <section id="product" className="bg-background py-16 md:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
          <div className="grid gap-8 md:grid-cols-[0.95fr_1.05fr] md:items-end">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Product
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Built around the real sailing workflow.
              </h2>
            </div>
            <p className="text-base leading-7 text-muted-foreground">
              Dock Out keeps the operating model simple: organizations own teams,
              teams work through venues and camps, and every session builds a reliable
              performance record.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PRODUCT_FEATURES.map((feature) => (
              <FeaturePanel key={feature.title} feature={feature} />
            ))}
          </div>

          <div className="mt-12 grid gap-3 md:grid-cols-5">
            {OPERATIONS.map((item, index) => (
              <div
                key={item.title}
                className="rounded-md border border-border bg-muted/40 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  0{index + 1}
                </p>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/30 py-16 md:py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Visibility
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              Know what happened on the water without rebuilding the story later.
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              Metrics are tied to the same session records teams use every day, so
              reporting reflects the actual operating flow instead of a separate
              spreadsheet process.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-4">
              {METRICS.slice(0, 2).map((metric) => (
                <MetricPanel key={metric.label} metric={metric} />
              ))}
            </div>
            <div className="rounded-md border border-border bg-background p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Season trend</p>
                  <p className="mt-1 text-3xl font-semibold text-foreground">+28%</p>
                </div>
                <TimerIcon className="size-5 text-primary" />
              </div>
              <div className="mt-8 flex h-36 items-end gap-2">
                {[34, 48, 52, 66, 74, 88].map((height, index) => (
                  <div
                    key={height}
                    className={cn(
                      "flex-1 rounded-t-sm bg-muted",
                      index === 5 ? "bg-primary" : "",
                    )}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <div className="mt-4 flex justify-between text-xs font-medium text-muted-foreground">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <MetricPanel metric={METRICS[2]} />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 text-foreground md:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Workflow
            </p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
              From plan to review in one operating loop.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {WORKFLOW_STEPS.map((step, index) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.title}
                  className="rounded-md border border-border bg-card/60 p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-6xl font-semibold leading-none text-muted-foreground/30">
                      {index + 1}
                    </span>
                    <Icon className="size-6 text-primary" />
                  </div>
                  <h3 className="mt-7 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="reports" className="bg-background py-16 md:py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 md:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Reports
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              Performance context at team and organization level.
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              Use daily activity to understand sessions per camp, total sailing time,
              venue history, highlighted sessions and broader operational trends.
            </p>
          </div>

          <div className="grid gap-4">
            {REPORT_FEATURES.map((feature) => (
              <FeaturePanel key={feature.title} feature={feature} orientation="row" />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/30 py-16 md:py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 text-center md:grid-cols-3 md:px-8">
          <MissionStat
            mark={
              <Image
                src="/49er_black.svg"
                alt="49er"
                width={180}
                height={66}
                className="mx-auto h-12 w-auto dark:invert"
              />
            }
            label="Setup templates for class-specific work"
          />
          <MissionStat
            mark={
              <Image
                src="/la28.svg"
                alt="LA28"
                width={154}
                height={246}
                className="mx-auto h-14 w-auto grayscale dark:invert"
              />
            }
            label="Built with high-performance campaigns in mind"
          />
          <MissionStat
            mark={
              <span className="text-4xl font-semibold tracking-tight text-foreground">
                PWA
              </span>
            }
            label="Fast entry from mobile and desktop operations"
          />
        </div>
      </section>

      <section id="pricing" className="bg-background py-16 md:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
          <ProPlanCard />
        </div>
      </section>

      <section className="bg-background px-4 py-16 md:px-8 md:py-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-md border border-border bg-card p-6 text-foreground md:flex-row md:items-center md:justify-between md:p-8">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Ready for the next session
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              Move your sailing operation out of scattered logs.
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Start with one organization, one team, one venue, one camp and three
              demo sessions, then move to Pro when the workflow is ready for daily use.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
            <Link
              href="/sign-in?mode=register"
              className={buttonVariants({
                size: "lg",
                className:
                  "h-11 !bg-foreground px-5 !text-background hover:!bg-foreground/90",
              })}
            >
              Start free
            </Link>
            <Link
              href="/sign-in"
              className={buttonVariants({
                size: "lg",
                variant: "outline",
                className:
                  "h-11 border-border bg-background/60 px-5 text-foreground hover:bg-muted hover:text-foreground",
              })}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/Black_49er.svg"
              alt=""
              width={28}
              height={28}
              className="size-7 dark:invert"
            />
            <div>
              <p className="text-sm font-semibold text-foreground">Dock Out</p>
              <p className="text-xs text-muted-foreground">
                Sailing operations platform {new Date().getFullYear()}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
            <Link href="/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
      </main>
    </LandingThemeShell>
  );
}

function HeroCollage() {
  return (
    <div className="group relative mx-auto min-h-[36rem] w-full max-w-xl md:min-h-[44rem] md:max-w-none">
      <div className="absolute left-0 top-6 w-[78%] overflow-hidden rounded-md border border-border bg-card shadow-2xl transition-transform duration-700 ease-out will-change-transform motion-safe:group-hover:-translate-x-2 motion-safe:group-hover:translate-y-1 md:top-8">
        <Image
          src="/49er-landing.jpg"
          alt="49er sailing campaign on the water"
          width={1440}
          height={1129}
          sizes="(min-width: 768px) 44rem, 90vw"
          className="aspect-[4/3] w-full object-cover grayscale"
          priority
        />
        <div className="flex items-center justify-between gap-4 border-t border-border bg-card p-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Active session
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              Palma Mallorca / 49er
            </p>
          </div>
          <SailboatIcon className="size-5 shrink-0 text-primary" />
        </div>
      </div>

      <div className="absolute right-2 top-8 w-[45%] rounded-md border border-border/60 bg-background/45 p-4 shadow-2xl backdrop-blur-xl transition-transform duration-700 ease-out will-change-transform supports-[backdrop-filter]:bg-background/35 motion-safe:group-hover:translate-x-2 motion-safe:group-hover:-translate-y-2 md:right-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Net time
          </p>
          <TimerIcon className="size-4 text-primary" />
        </div>
        <p className="mt-5 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          01h 32m
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Since dock out</p>
      </div>

      <div className="absolute bottom-20 left-8 w-[54%] rounded-md border border-border/60 bg-background/45 p-4 shadow-2xl backdrop-blur-xl transition-transform duration-700 ease-out will-change-transform supports-[backdrop-filter]:bg-background/35 motion-safe:group-hover:-translate-x-2 motion-safe:group-hover:translate-y-2 md:left-10">
        <div className="flex items-center gap-2">
          <CameraIcon className="size-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Media captured</p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Image
            src="/49er-landing2.jpg"
            alt=""
            width={96}
            height={96}
            sizes="5rem"
            quality={12}
            className="aspect-square rounded-sm border border-border object-cover grayscale"
          />
          <Image
            src="/49er-landing3.jpeg"
            alt=""
            width={96}
            height={96}
            sizes="5rem"
            quality={12}
            className="aspect-square rounded-sm border border-border object-cover grayscale"
          />
          <Image
            src="/49er-landing.jpg"
            alt=""
            width={96}
            height={96}
            sizes="5rem"
            quality={12}
            className="aspect-square rounded-sm border border-border object-cover grayscale"
          />
        </div>
      </div>

      <div className="absolute bottom-16 right-4 w-[40%] rounded-md border border-border bg-card p-4 shadow-2xl transition-transform duration-700 ease-out will-change-transform motion-safe:group-hover:translate-x-2 motion-safe:group-hover:translate-y-1 md:right-6">
        <div className="flex items-center justify-between gap-3">
          <CloudSunIcon className="size-5 text-primary" />
          <WindIcon className="size-5 text-primary" />
        </div>
        <p className="mt-4 text-sm font-semibold text-foreground">Wind pattern logged</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">12-16 kt / offshore</p>
      </div>

      <div className="absolute left-[45%] top-[42%] hidden w-[34%] rounded-md border border-border bg-background p-4 shadow-2xl transition-transform duration-700 ease-out will-change-transform motion-safe:group-hover:-translate-y-2 md:block">
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Coach review</p>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Keep starts, maneuvers and setup notes connected to the same session.
        </p>
      </div>
    </div>
  );
}

function FeaturePanel({
  feature,
  orientation = "stack",
}: {
  feature: FeatureCard;
  orientation?: "stack" | "row";
}) {
  const Icon = feature.icon;

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-background p-5 shadow-sm",
        orientation === "row" ? "flex gap-4" : "",
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className={orientation === "row" ? "min-w-0" : "mt-6"}>
        <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {feature.description}
        </p>
      </div>
    </div>
  );
}

function MetricPanel({
  metric,
}: {
  metric: (typeof METRICS)[number];
}) {
  return (
    <div className="rounded-md border border-border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
            {metric.value}
          </p>
        </div>
        <CheckCircle2Icon className="size-5 text-primary" />
      </div>
      <p className="mt-5 text-sm leading-6 text-muted-foreground">{metric.helper}</p>
    </div>
  );
}

function MissionStat({ mark, label }: { mark: ReactNode; label: string }) {
  return (
    <div className="space-y-3">
      <div className="flex min-h-14 items-center justify-center">{mark}</div>
      <p className="mx-auto max-w-xs text-sm leading-6 text-muted-foreground">{label}</p>
    </div>
  );
}
