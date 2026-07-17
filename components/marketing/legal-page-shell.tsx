import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LegalSection = {
  id: string;
  title: string;
  children: ReactNode;
};

type LegalPageShellProps = {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalSection[];
};

const DOCKOUT_LOGO = {
  src: "/dockout-logo-horizontal2.svg",
  width: 3282,
  height: 681,
} as const;

export function LegalPageShell({
  title,
  subtitle,
  lastUpdated,
  sections,
}: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex min-w-0 items-center" aria-label="Dockout home">
            <Image
              src={DOCKOUT_LOGO.src}
              alt=""
              width={DOCKOUT_LOGO.width}
              height={DOCKOUT_LOGO.height}
              sizes="9rem"
              className="h-6 w-auto object-contain invert dark:invert-0 sm:h-7"
              priority
            />
          </Link>

          <Link
            href="/sign-in"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className:
                "h-11 border-border bg-background/80 px-4 text-foreground hover:bg-muted md:h-7 md:px-2.5",
            })}
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="border-b border-border bg-muted/30 px-4 py-12 md:px-8 md:py-16">
        <div className="mx-auto w-full max-w-4xl space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Dockout legal
          </p>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-normal text-foreground md:text-6xl">
              {title}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              {subtitle}
            </p>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
        </div>
      </section>

      <section className="px-4 py-10 md:px-8 md:py-14">
        <div className="mx-auto grid w-full max-w-4xl gap-10 lg:grid-cols-[13rem_1fr] lg:items-start">
          <nav className="hidden lg:block lg:sticky lg:top-8">
            <div className="space-y-2 border-l border-border pl-4">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </nav>

          <div className="space-y-10">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-8 border-b border-border pb-10 last:border-b-0 last:pb-0"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {section.title}
                </h2>
                <div
                  className={cn(
                    "mt-4 space-y-4 text-sm leading-6 text-muted-foreground",
                    "[&_a]:font-medium [&_a]:text-foreground [&_a]:underline-offset-4 [&_a:hover]:underline",
                    "[&_li]:pl-1 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2",
                  )}
                >
                  {section.children}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
