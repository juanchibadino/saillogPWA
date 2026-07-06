"use client";

import { CreateWindPatternDialog } from "@/features/wind-patterns/wind-patterns-form-dialogs";
import { WindPatternsTable } from "@/features/wind-patterns/wind-patterns-table";
import { WindPatternsToolbar } from "@/features/wind-patterns/wind-patterns-toolbar";
import type { TeamVenueWindPatternsPageData } from "@/features/wind-patterns/data";
import type { VenueDetailTabDataByTab } from "@/features/venues/detail-types";
import { buildVenueDetailHref } from "@/features/venues/navigation";
import type { NavigationScope } from "@/lib/navigation/types";

export type VenueWindPatternStatusFilter = "active" | "archived" | "all";

function buildWindPatternsFiltersHref(input: {
  scope: NavigationScope;
  teamVenueId: string;
  year: number;
  statusFilter?: VenueWindPatternStatusFilter;
}): string {
  const href = buildVenueDetailHref({
    scope: input.scope,
    teamVenueId: input.teamVenueId,
    tab: "wind-patterns",
    year: input.year,
  });

  if (!input.statusFilter || input.statusFilter === "active") {
    return href;
  }

  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}statusFilter=${input.statusFilter}`;
}

function filterWindPatternsByStatus(input: {
  patterns: TeamVenueWindPatternsPageData["patterns"];
  statusFilter: VenueWindPatternStatusFilter;
}): TeamVenueWindPatternsPageData["patterns"] {
  if (input.statusFilter === "all") {
    return input.patterns;
  }

  if (input.statusFilter === "archived") {
    return input.patterns.filter((pattern) => !pattern.isActive);
  }

  return input.patterns.filter((pattern) => pattern.isActive);
}

export function VenueWindPatternsPanel({
  canManageWindPatterns,
  data,
  scope,
  selectedYear,
  statusFilter,
  teamVenueId,
}: {
  canManageWindPatterns: boolean;
  data: VenueDetailTabDataByTab["wind-patterns"];
  scope: NavigationScope;
  selectedYear: number;
  statusFilter: VenueWindPatternStatusFilter;
  teamVenueId: string;
}) {
  const filteredPatterns = filterWindPatternsByStatus({
    patterns: data.windPatterns.patterns,
    statusFilter,
  });

  return (
    <WindPatternsTable
      patterns={filteredPatterns}
      canManageWindPatterns={canManageWindPatterns}
      selectedStatusFilter={statusFilter}
      scope={scope}
      teamVenueId={teamVenueId}
      year={selectedYear}
      toolbar={
        <WindPatternsToolbar
          selectedValue={statusFilter}
          options={[
            {
              value: "active",
              label: "Active",
              href: buildWindPatternsFiltersHref({
                scope,
                teamVenueId,
                year: selectedYear,
                statusFilter: "active",
              }),
              count: data.windPatterns.activeCount,
            },
            {
              value: "archived",
              label: "Archived",
              href: buildWindPatternsFiltersHref({
                scope,
                teamVenueId,
                year: selectedYear,
                statusFilter: "archived",
              }),
              count: data.windPatterns.archivedCount,
            },
            {
              value: "all",
              label: "All",
              href: buildWindPatternsFiltersHref({
                scope,
                teamVenueId,
                year: selectedYear,
                statusFilter: "all",
              }),
              count: data.windPatterns.activeCount + data.windPatterns.archivedCount,
            },
          ]}
          action={
            <CreateWindPatternDialog
              scope={scope}
              teamVenueId={teamVenueId}
              statusFilter={statusFilter}
              year={selectedYear}
              disabled={!canManageWindPatterns}
            />
          }
        />
      }
    />
  );
}
