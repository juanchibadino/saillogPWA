"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { apiGet } from "@/features/admin/api";

type JobListItem = {
  id: string;
  quoteId: string;
  status: string;
  projectedRevenue: number;
  projectedTotalCost: number;
  projectedMargin: number;
  actualTotalCost: number | null;
  actualMargin: number | null;
  dueDate: string | null;
  createdAt: string;
  customerName: string | null;
};

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const payload = await apiGet<JobListItem[]>("/api/admin/jobs");
        setJobs(payload);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error inesperado.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Listado de jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton columns={6} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs text-muted-foreground">
                  <TableHead>Job</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Margen proj/real</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
                    <TableCell>{job.customerName ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{job.status}</Badge>
                    </TableCell>
                    <TableCell>${job.projectedRevenue.toFixed(2)}</TableCell>
                    <TableCell>
                      ${job.projectedMargin.toFixed(2)} /{" "}
                      {job.actualMargin === null ? "-" : `$${job.actualMargin.toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/jobs/${job.id}`}
                        className={buttonVariants({ variant: "link", size: "xs" })}
                      >
                        Abrir
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
