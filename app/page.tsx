import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProPlanCard } from "@/components/marketing/pro-plan-card";
import { getCurrentAccessContext } from "@/lib/auth/access";

const ENTITY_CARDS = [
  {
    title: "Organization",
    description: "Top-level account for ownership, membership and reporting.",
  },
  {
    title: "Teams",
    description: "Operational sailing units managed under one organization.",
  },
  {
    title: "Venues",
    description: "Stable sailing locations reused across seasons and years.",
  },
  {
    title: "Camps",
    description: "Training or regatta blocks inside each team venue context.",
  },
  {
    title: "Sessions",
    description: "Daily sailing logs with setup, review and performance data.",
  },
] as const;

const METRIC_CARDS = [
  {
    title: "Net time sailed",
    value: "146 h 20 m",
    description: "Tracked from your sessions timeline.",
  },
  {
    title: "Total sessions",
    value: "84",
    description: "All sessions recorded in selected scope.",
  },
  {
    title: "Avg time in water since dock out",
    value: "2 h 14 m",
    description: "Average duration from dock-out to dock-in.",
  },
] as const;

export default async function Home() {
  const context = await getCurrentAccessContext();

  if (context.user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-slate-100 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-8 md:gap-24 md:px-8 md:py-12">
        <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 shadow-sm backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/Black_49er.svg"
              alt="Sailog logo"
              width={32}
              height={32}
              className="size-8"
            />
            <div>
              <p className="text-sm font-semibold tracking-wide text-slate-900">Sailog</p>
              <p className="text-xs text-slate-600">Sailing Operations Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
              })}
            >
              Sign in
            </Link>
            <Link
              href="/sign-in?mode=register"
              className={buttonVariants({
                size: "sm",
                className: "bg-blue-700 text-white hover:bg-blue-600",
              })}
            >
              Get started
            </Link>
          </div>
        </header>

        <section className="grid items-center gap-8 rounded-3xl border border-slate-200 bg-white px-6 py-10 shadow-sm md:grid-cols-[1.1fr_0.9fr] md:px-10">
          <div className="space-y-5">
            <p className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium tracking-wide text-blue-700">
              Marketing Landing
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Stop using sheets and paper. Log everything in one easy web and mobile app.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-600">
              Sailog is built for fast daily operations: organization setup, team flow,
              session logging, notes and performance tracking in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sign-in?mode=register"
                className={buttonVariants({
                  size: "lg",
                  className: "bg-blue-700 text-white hover:bg-blue-600",
                })}
              >
                Start now
              </Link>
              <Link
                href="/sign-in"
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className:
                    "border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
                })}
              >
                Sign in
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-900">Why Sailog</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>One workflow from organization to sessions</li>
              <li>Built for mobile and desktop operations</li>
              <li>Role-based access for internal teams</li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Operations Model</h2>
            <p className="mt-1 text-sm text-slate-600">
              Structured records for your full sailing workflow.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {ENTITY_CARDS.map((item) => (
              <Card key={item.title} className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-relaxed text-slate-600">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Custom Metrics</h2>
            <p className="mt-1 text-sm text-slate-600">
              Keep operational visibility without manual spreadsheets or paper logs.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {METRIC_CARDS.map((item) => (
              <Card key={item.title} className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{item.title}</p>
                  <CardTitle className="text-3xl">{item.value}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Screen</h2>
            <p className="mt-1 text-sm text-slate-600">
              Real product screen used by internal teams.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Image
              src="/Screen.png"
              alt="Sailog product screen"
              width={1826}
              height={1012}
              className="h-auto w-full"
              priority
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-900 px-6 py-7 text-white shadow-sm md:px-8">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
            Built by sailors
          </p>
          <h3 className="mt-3 text-2xl font-semibold leading-tight md:text-3xl">
            Created by Olympic sailors and Olympic coaches from different countries.
          </h3>
          <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
            Let&apos;s work towards LA28 with sailing.
          </p>
        </section>

        <section className="space-y-6">
          <ProPlanCard />
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Reports</h2>
            <p className="mt-1 text-sm text-slate-600">
              Analyze performance at both organization and team level.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="border-slate-200 bg-slate-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Organization-level aggregate data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-slate-700">
                <p>Total net time sailed by organization</p>
                <p>Total sessions by venue and period</p>
                <p>Cross-team operational activity view</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Team-level data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-slate-700">
                <p>Team session history and highlights</p>
                <p>Average water time and trend by camp</p>
                <p>Performance breakdown by venue</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <footer className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/Black_49er.svg"
                alt="Sailog logo"
                width={24}
                height={24}
                className="size-6"
              />
              <p className="text-sm text-slate-600">
                Sailog © {new Date().getFullYear()} · Internal Sailing Operations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: "text-slate-700 hover:bg-slate-100",
                })}
              >
                Sign in
              </Link>
              <Link
                href="/sign-in?mode=register"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
                })}
              >
                Register
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
