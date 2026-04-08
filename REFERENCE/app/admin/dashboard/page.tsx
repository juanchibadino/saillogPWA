"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { apiGet } from "@/features/admin/api";

type DashboardPayload = {
  counts: {
    leads: number;
    quotes: number;
    jobs: number;
    purchases: number;
  };
  statusCounts: {
    leads: Record<string, number>;
    quotes: Record<string, number>;
    jobs: Record<string, number>;
    purchases: Record<string, number>;
  };
  totals: {
    projectedRevenue: number;
    projectedCost: number;
    projectedMargin: number;
    actualCost: number;
    actualMargin: number;
  };
  recentJobs: Array<{
    id: string;
    status: string;
    projectedRevenue: number;
    projectedTotalCost: number;
    projectedMargin: number;
    actualTotalCost: number | null;
    actualMargin: number | null;
    createdAt: string;
    marginDeviation: number | null;
  }>;
};

function renderStatusMap(statusMap: Record<string, number>) {
  const entries = Object.entries(statusMap);

  if (entries.length === 0) {
    return "-";
  }

  return entries
    .map(([status, count]) => `${status}: ${count}`)
    .join(" | ");
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const payload = await apiGet<DashboardPayload>("/api/admin/dashboard");
        setData(payload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error inesperado.");
      }
    }

    void load();
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold">Resumen del flujo</h1>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={`count-skeleton-${index}`}>
              <CardHeader>
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ultimos jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <TableSkeleton columns={5} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold">Resumen del flujo</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Leads</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.counts.leads}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quotes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.counts.quotes}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Jobs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.counts.jobs}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Compras</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.counts.purchases}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Estado por etapa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Leads: {renderStatusMap(data.statusCounts.leads)}</p>
          <p>Quotes: {renderStatusMap(data.statusCounts.quotes)}</p>
          <p>Jobs: {renderStatusMap(data.statusCounts.jobs)}</p>
          <p>Compras: {renderStatusMap(data.statusCounts.purchases)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Totales economicos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-5">
          <p>Revenue proj: ${data.totals.projectedRevenue.toFixed(2)}</p>
          <p>Costo proj: ${data.totals.projectedCost.toFixed(2)}</p>
          <p>Margen proj: ${data.totals.projectedMargin.toFixed(2)}</p>
          <p>Costo real: ${data.totals.actualCost.toFixed(2)}</p>
          <p>Margen real: ${data.totals.actualMargin.toFixed(2)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Ultimos jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground">
                <TableHead>Job</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Margen proj</TableHead>
                <TableHead>Margen real</TableHead>
                <TableHead>Desvio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
                  <TableCell>{job.status}</TableCell>
                  <TableCell>${job.projectedMargin.toFixed(2)}</TableCell>
                  <TableCell>
                    {job.actualMargin === null ? "-" : `$${job.actualMargin.toFixed(2)}`}
                  </TableCell>
                  <TableCell>
                    {job.marginDeviation === null ? "-" : `$${job.marginDeviation.toFixed(2)}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
