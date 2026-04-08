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

type QuoteListItem = {
  id: string;
  leadId: string;
  status: string;
  subtotal: number;
  total: number;
  createdAt: string;
  approvedAt: string | null;
  customerName: string | null;
  itemCount: number;
};

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const payload = await apiGet<QuoteListItem[]>("/api/admin/quotes");
        setQuotes(payload);
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
        <h1 className="mt-1 text-2xl font-semibold">Quotes</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Listado de quotes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton columns={6} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs text-muted-foreground">
                  <TableHead>Quote</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-mono text-xs">{quote.id.slice(0, 8)}</TableCell>
                    <TableCell>{quote.customerName ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{quote.status}</Badge>
                    </TableCell>
                    <TableCell>{quote.itemCount}</TableCell>
                    <TableCell>${quote.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/quotes/${quote.id}`}
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
