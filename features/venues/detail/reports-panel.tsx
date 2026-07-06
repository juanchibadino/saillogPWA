"use client";

import { CreateReportDialog } from "@/features/reports/report-form-dialogs";
import type { VenueDetailTabDataByTab } from "@/features/venues/detail-types";
import { buildVenueDetailHref } from "@/features/venues/navigation";
import type { NavigationScope } from "@/lib/navigation/types";

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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Reports</h3>
          <p className="text-sm text-muted-foreground">
            Team venue report records for {selectedYear}.
          </p>
        </div>

        {canManageReports ? (
          <CreateReportDialog
            scope={scope}
            teamVenueId={teamVenueId}
            year={selectedYear}
            redirectTo={reportCreateRedirectTo}
            campOptions={reportCampOptions}
            disabled={reportCampOptions.length === 0}
          />
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
        <p className="text-sm text-muted-foreground">
          No reports created yet for {selectedYear}.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {data.reports.map((report) => (
            <li key={report.id}>
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-md -mx-2 px-2 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{report.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.campCount} {report.campCount === 1 ? "camp" : "camps"} ·{" "}
                    {report.campNames.join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDateTimeLabel(report.createdAt)} UTC
                  </p>
                </div>

                <a
                  href={`/api/reports/${report.id}/pdf`}
                  className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Download PDF
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
