"use client";

import { DownloadIcon } from "lucide-react";

import { GradientCard } from "@/components/shared/gradient-card";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateReportDialog } from "@/features/reports/report-form-dialogs";
import type { VenueDetailTabDataByTab } from "@/features/venues/detail-types";
import { buildVenueDetailHref } from "@/features/venues/navigation";
import type { NavigationScope } from "@/lib/navigation/types";
import { cn } from "@/lib/utils";

function formatDateTimeLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function formatReportCampCount(count: number): string {
  return `${count} ${count === 1 ? "camp" : "camps"}`;
}

function formatReportCampNames(campNames: string[]): string {
  return campNames.length > 0 ? campNames.join(", ") : "No camps linked";
}

export function VenueReportsPanel({
  canManageReports,
  data,
  scope,
  selectedYear,
  teamVenueId,
}: {
  canManageReports: boolean;
  data: VenueDetailTabDataByTab["reports"];
  scope: NavigationScope;
  selectedYear: number;
  teamVenueId: string;
}) {
  const reportCreateRedirectTo = buildVenueDetailHref({
    scope,
    teamVenueId,
    tab: "reports",
    year: selectedYear,
  });
  const reportCampOptions = data.camps.map((camp) => ({
    campId: camp.id,
    name: camp.name,
    dateRangeLabel: camp.dateRangeLabel,
  }));

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:hidden">
            Reports {selectedYear}
          </h1>
          <h2 className="hidden text-lg font-semibold md:block">
            Reports {selectedYear}
          </h2>
        </div>

        {canManageReports ? (
          <div className="shrink-0">
            <div className="md:hidden">
              <CreateReportDialog
                scope={scope}
                teamVenueId={teamVenueId}
                year={selectedYear}
                redirectTo={reportCreateRedirectTo}
                campOptions={reportCampOptions}
                disabled={reportCampOptions.length === 0}
                surface="drawer"
                triggerVariant="fab"
              />
            </div>
            <div className="hidden md:block">
              <CreateReportDialog
                scope={scope}
                teamVenueId={teamVenueId}
                year={selectedYear}
                redirectTo={reportCreateRedirectTo}
                campOptions={reportCampOptions}
                disabled={reportCampOptions.length === 0}
              />
            </div>
          </div>
        ) : null}
      </header>

      {!canManageReports ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            You have read-only access in this scope. Report creation is limited to team admins and coaches.
          </p>
        </section>
      ) : null}

      {data.reports.length === 0 ? (
        <>
          <GradientCard className="px-4 py-6 text-sm text-muted-foreground md:hidden">
            No reports created yet for {selectedYear}.
          </GradientCard>
          <GradientCard className="hidden px-4 py-6 text-sm text-muted-foreground md:block">
            No reports created yet for {selectedYear}.
          </GradientCard>
        </>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {data.reports.map((report) => (
              <GradientCard key={report.id} className="px-3 py-3">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{report.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatReportCampCount(report.campCount)}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {formatReportCampNames(report.campNames)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDateTimeLabel(report.createdAt)} UTC
                    </p>
                  </div>

                  <a
                    href={`/api/reports/${report.id}/pdf`}
                    aria-label={`Download PDF for ${report.name}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "h-11 w-11 px-0",
                    )}
                  >
                    <DownloadIcon className="size-4" />
                  </a>
                </div>
              </GradientCard>
            ))}
          </div>

          <GradientCard className="hidden overflow-hidden p-0 md:block">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Report</TableHead>
                  <TableHead>Camps</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-28 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <p>{formatReportCampCount(report.campCount)}</p>
                      <p className="max-w-80 truncate">
                        {formatReportCampNames(report.campNames)}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTimeLabel(report.createdAt)} UTC
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`/api/reports/${report.id}/pdf`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <DownloadIcon className="size-4" />
                        PDF
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GradientCard>
        </>
      )}
    </div>
  );
}
