"use client";

import { Loader2Icon, MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { GradientCard } from "@/components/shared/gradient-card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CampActionsMenu,
  CreateCampDialog,
} from "@/features/camps/camp-form-dialogs";
import type { TeamCampVenueOption } from "@/features/camps/data";
import { buildCampDetailHref } from "@/features/camps/navigation";
import type { VenueDetailTabDataByTab } from "@/features/venues/detail-types";
import { buildVenueDetailHref } from "@/features/venues/navigation";
import type { NavigationScope } from "@/lib/navigation/types";
import { cn } from "@/lib/utils";

type VenueCampItem = VenueDetailTabDataByTab["camps"]["camps"][number];

function formatCampTypeLabel(value: VenueCampItem["campType"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function VenueCampsPanel({
  canCreateCamps,
  canDeleteCamps,
  canManageCamps,
  data,
  scope,
  selectedYear,
  teamVenueId,
  venueId,
  venueLocation,
  venueName,
}: {
  canCreateCamps: boolean;
  canDeleteCamps: boolean;
  canManageCamps: boolean;
  data: VenueDetailTabDataByTab["camps"];
  scope: NavigationScope;
  selectedYear: number;
  teamVenueId: string;
  venueId: string;
  venueLocation: string;
  venueName: string;
}) {
  const router = useRouter();
  const [navigatingCampId, setNavigatingCampId] = useState<string | null>(null);
  const [, startCampNavigationTransition] = useTransition();
  const teamVenueOptions: TeamCampVenueOption[] = [
    {
      teamVenueId,
      venueId,
      venueName,
      venueLocation,
    },
  ];
  const campReturnPath = buildVenueDetailHref({
    scope,
    teamVenueId,
    tab: "camps",
    year: selectedYear,
  });

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
        <div className="shrink-0">
          <div className="md:hidden">
            <CreateCampDialog
              teamVenueOptions={teamVenueOptions}
              scope={scope}
              selectedVenueId={venueId}
              currentPage={1}
              returnPath={campReturnPath}
              disabled={!canCreateCamps}
              surface="drawer"
              triggerVariant="fab"
            />
          </div>
          <div className="hidden md:block">
            <CreateCampDialog
              teamVenueOptions={teamVenueOptions}
              scope={scope}
              selectedVenueId={venueId}
              currentPage={1}
              returnPath={campReturnPath}
              disabled={!canCreateCamps}
              surface="sheet"
            />
          </div>
        </div>
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

                    <div
                      className="shrink-0 self-center"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      {isNavigatingToCamp ? (
                        <div className="flex h-11 w-11 items-center justify-center text-muted-foreground">
                          <Loader2Icon className="size-4 animate-spin" />
                        </div>
                      ) : canManageCamps || canDeleteCamps ? (
                        <CampActionsMenu
                          camp={camp}
                          teamVenueOptions={teamVenueOptions}
                          scope={scope}
                          selectedVenueId={venueId}
                          currentPage={1}
                          returnPath={campReturnPath}
                          canEditCamp={canManageCamps}
                          canDeleteCamp={canDeleteCamps}
                          editSurface="drawer"
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled
                          aria-label="More actions unavailable"
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </GradientCard>
              );
            })}
          </div>

          <GradientCard className="hidden overflow-hidden p-0 md:block">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Camp</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead className="w-12 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.camps.map((camp) => {
                  const detailHref = buildCampHref(camp.id);
                  const isNavigatingToCamp = navigatingCampId === camp.id;

                  return (
                    <TableRow
                      key={camp.id}
                      role="link"
                      tabIndex={0}
                      aria-busy={isNavigatingToCamp}
                      className={cn("cursor-pointer", isNavigatingToCamp && "opacity-80")}
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
                      <TableCell className="font-medium">
                        <Link
                          href={detailHref}
                          className="underline-offset-4 hover:underline"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            navigateToCamp(camp.id, detailHref);
                          }}
                          onMouseEnter={() => prefetchCamp(detailHref)}
                          onFocus={() => prefetchCamp(detailHref)}
                        >
                          {camp.name}
                        </Link>
                      </TableCell>
                      <TableCell>{formatCampTypeLabel(camp.campType)}</TableCell>
                      <TableCell>{camp.dateRangeLabel}</TableCell>
                      <TableCell className="tabular-nums">{camp.sessionCount}</TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        {isNavigatingToCamp ? (
                          <div className="flex justify-end text-muted-foreground">
                            <Loader2Icon className="size-4 animate-spin" />
                          </div>
                        ) : canManageCamps || canDeleteCamps ? (
                          <CampActionsMenu
                            camp={camp}
                            teamVenueOptions={teamVenueOptions}
                            scope={scope}
                            selectedVenueId={venueId}
                            currentPage={1}
                            returnPath={campReturnPath}
                            canEditCamp={canManageCamps}
                            canDeleteCamp={canDeleteCamps}
                            editSurface="sheet"
                          />
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled
                            aria-label="More actions unavailable"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </GradientCard>
        </>
      )}
    </section>
  );
}
