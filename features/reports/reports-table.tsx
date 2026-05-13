import type { ReportListItem } from "@/features/reports/data"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ReportsTableMode = "team" | "organization"

function formatDateTimeLabel(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown date"
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date)
}

export function ReportsTable({
  reports,
  mode,
  emptyMessage,
}: {
  reports: ReportListItem[]
  mode: ReportsTableMode
  emptyMessage: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead>Report</TableHead>
            {mode === "organization" ? <TableHead>Team</TableHead> : null}
            <TableHead>Venue</TableHead>
            <TableHead>Camps</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-28 text-right" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {reports.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={mode === "organization" ? 6 : 5}
                className="py-6 text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="font-medium">{report.name}</TableCell>
                {mode === "organization" ? (
                  <TableCell>{report.teamName ?? "Unknown team"}</TableCell>
                ) : null}
                <TableCell>{report.venueName ?? "Unknown venue"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <p>
                    {report.campCount} {report.campCount === 1 ? "camp" : "camps"}
                  </p>
                  <p className="truncate">{report.campNames.join(", ")}</p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTimeLabel(report.createdAt)} UTC
                </TableCell>
                <TableCell className="text-right">
                  <a
                    href={`/api/reports/${report.id}/pdf`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    PDF
                  </a>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
