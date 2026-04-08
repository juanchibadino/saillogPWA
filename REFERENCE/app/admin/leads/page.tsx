"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

type LeadListItem = {
  id: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  status: string;
  preliminaryTotal: number;
  itemCount: number;
};

export default function AdminLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const payload = await apiGet<LeadListItem[]>("/api/admin/leads");
        setLeads(payload);
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
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Comercial</p>
        <h1 className="mt-1 text-2xl font-semibold">Leads</h1>
      </header>

      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={6} rows={8} />
          ) : (
            <>
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
                    <TableHead className="h-10 px-3">Lead</TableHead>
                    <TableHead className="h-10 px-3">Cliente</TableHead>
                    <TableHead className="h-10 px-3">Telefono</TableHead>
                    <TableHead className="h-10 px-3">Estado</TableHead>
                    <TableHead className="h-10 px-3">Items</TableHead>
                    <TableHead className="h-10 px-3">Preliminar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => router.push(`/admin/leads/${lead.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/admin/leads/${lead.id}`);
                        }
                      }}
                    >
                      <TableCell className="px-3 py-2.5 font-mono text-xs">{lead.id.slice(0, 8)}</TableCell>
                      <TableCell className="px-3 py-2.5">
                        <p className="font-medium leading-5">{lead.customerName}</p>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-sm">{lead.customerPhone}</TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Badge variant="outline">{lead.status}</Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">{lead.itemCount}</TableCell>
                      <TableCell className="px-3 py-2.5">${lead.preliminaryTotal.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {leads.length === 0 ? (
                <p className="mt-3 px-3 pb-3 text-sm text-muted-foreground">No hay leads cargados.</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
