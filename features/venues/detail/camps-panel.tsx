"use client";

import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { GradientCard } from "@/components/shared/gradient-card";
import { buildCampDetailHref } from "@/features/camps/navigation";
import type { VenueDetailTabDataByTab } from "@/features/venues/detail-types";
import type { NavigationScope } from "@/lib/navigation/types";
import { cn } from "@/lib/utils";

export function VenueCampsPanel({
  data,
  scope,
  selectedYear,
}: {
  data: VenueDetailTabDataByTab["camps"];
  scope: NavigationScope;
  selectedYear: number;
}) {
  const router = useRouter();
  const [navigatingCampId, setNavigatingCampId] = useState<string | null>(null);
  const [, startCampNavigationTransition] = useTransition();

  function buildCampHref(campId: string): string {
    return buildCampDetailHref({
      scope,
      campId,
      tab: "sessions",
    });
  }

  function navigateToCamp(campId: string, detailHref: string): void {
    setNavigatingCampId(campId);
    startCampNavigationTransition(() => {
      router.push(detailHref);
    });
  }

  function prefetchCamp(detailHref: string): void {
    router.prefetch(detailHref);
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
          Camps {selectedYear}
        </h1>
        <h2 className="hidden text-lg font-semibold md:block">
          Camps {selectedYear}
        </h2>
      </header>

      {data.camps.length === 0 ? (
        <>
          <GradientCard className="px-4 py-6 text-sm text-muted-foreground md:hidden">
            No camps found for {selectedYear}.
          </GradientCard>
          <GradientCard className="hidden px-4 py-6 text-sm text-muted-foreground md:block">
            No camps found for {selectedYear}.
          </GradientCard>
        </>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {data.camps.map((camp) => {
              const detailHref = buildCampHref(camp.id);
              const isNavigatingToCamp = navigatingCampId === camp.id;

              return (
                <GradientCard
                  key={camp.id}
                  role="link"
                  tabIndex={0}
                  aria-busy={isNavigatingToCamp}
                  className={cn(
                    "cursor-pointer px-3 py-3 transition-colors hover:bg-muted/30",
                    isNavigatingToCamp && "opacity-80",
                  )}
                  onMouseEnter={() => prefetchCamp(detailHref)}
                  onFocus={() => prefetchCamp(detailHref)}
                  onClick={() => {
                    navigateToCamp(camp.id, detailHref);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigateToCamp(camp.id, detailHref);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{camp.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {camp.dateRangeLabel}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sessions · <span className="tabular-nums">{camp.sessionCount}</span>
                      </p>
                    </div>

                    <div className="flex h-11 w-11 shrink-0 self-center items-center justify-center text-muted-foreground">
                      {isNavigatingToCamp ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <ChevronRightIcon className="size-4" />
                      )}
                    </div>
                  </div>
                </GradientCard>
              );
            })}
          </div>

          <GradientCard className="hidden overflow-hidden p-0 md:block">
            <div className="divide-y divide-border">
              {data.camps.map((camp) => {
                const detailHref = buildCampHref(camp.id);
                const isNavigatingToCamp = navigatingCampId === camp.id;

                return (
                  <div
                    key={camp.id}
                    role="link"
                    tabIndex={0}
                    aria-busy={isNavigatingToCamp}
                    className={cn(
                      "grid min-h-14 cursor-pointer grid-cols-[1.2fr_1fr_0.5fr_3rem] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30",
                      isNavigatingToCamp && "opacity-80",
                    )}
                    onMouseEnter={() => prefetchCamp(detailHref)}
                    onFocus={() => prefetchCamp(detailHref)}
                    onClick={() => {
                      navigateToCamp(camp.id, detailHref);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigateToCamp(camp.id, detailHref);
                      }
                    }}
                  >
                    <p className="truncate text-sm font-medium">{camp.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {camp.dateRangeLabel}
                    </p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {camp.sessionCount}
                    </p>
                    <div className="flex justify-end text-muted-foreground">
                      {isNavigatingToCamp ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <ChevronRightIcon className="size-4" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </GradientCard>
        </>
      )}
    </section>
  );
}
