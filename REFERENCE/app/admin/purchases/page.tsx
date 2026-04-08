"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { apiGet, apiPatch } from "@/features/admin/api";
import { PurchaseForm } from "@/features/admin/purchases/purchase-form";
import type {
  PurchaseCatalogItem,
  PurchaseRecord,
  PurchaseStatus,
  PurchaseStockPayload,
  SupplierOption,
} from "@/features/admin/purchases/types";

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatStatusLabel(status: PurchaseStatus) {
  if (status === "draft") {
    return "Borrador";
  }

  if (status === "ordered") {
    return "Ordenado";
  }

  if (status === "received") {
    return "Recibido";
  }

  return "Cancelado";
}

function statusVariant(status: PurchaseStatus): "default" | "secondary" | "outline" | "destructive" {
  if (status === "received") {
    return "default";
  }

  if (status === "cancelled") {
    return "destructive";
  }

  if (status === "ordered") {
    return "outline";
  }

  return "secondary";
}

function summarizeItems(purchase: PurchaseRecord) {
  const visibleItems = purchase.items
    .slice(0, 2)
    .map((item) => item.catalogItemName ?? item.description ?? "Item");

  if (purchase.items.length <= 2) {
    return visibleItems.join(" · ");
  }

  return `${visibleItems.join(" · ")} +${purchase.items.length - 2}`;
}

export default function AdminPurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [catalogItems, setCatalogItems] = useState<PurchaseCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [purchasesPayload, suppliersPayload, stockPayload] = await Promise.all([
        apiGet<PurchaseRecord[]>("/api/admin/purchases"),
        apiGet<SupplierOption[]>("/api/admin/suppliers"),
        apiGet<PurchaseStockPayload>("/api/admin/stock"),
      ]);

      setPurchases(purchasesPayload);
      setSuppliers(suppliersPayload);
      setCatalogItems((stockPayload.items ?? []).filter((item) => item.active));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAsReceived(purchaseId: string) {
    try {
      await apiPatch(`/api/admin/purchases/${purchaseId}`, {
        status: "received",
      });
      await load();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Error inesperado.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Registrar compra</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseForm
            suppliers={suppliers}
            catalogItems={catalogItems}
            onSubmitted={load}
            submitLabel="Registrar"
          />
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-2">
        <div className="px-1">
          <h2 className="text-sm font-medium">Compras registradas</h2>
        </div>
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={9} />
          ) : (
            <Table>
              <TableHeader className="bg-muted">
                <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
                  <TableHead className="h-10 px-3">Compra</TableHead>
                  <TableHead className="h-10 px-3">Proveedor</TableHead>
                  <TableHead className="h-10 px-3">Estado</TableHead>
                  <TableHead className="h-10 px-3">Job</TableHead>
                  <TableHead className="h-10 px-3 text-right">Neto</TableHead>
                  <TableHead className="h-10 px-3 text-right">IVA</TableHead>
                  <TableHead className="h-10 px-3 text-right">Total</TableHead>
                  <TableHead className="h-10 px-3">Items</TableHead>
                  <TableHead className="h-10 w-40 px-3 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="px-3 py-2.5">
                      <div className="space-y-1">
                        <p className="font-medium leading-5">#{purchase.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          Creada {formatDate(purchase.createdAt)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <div className="space-y-1 text-sm leading-5">
                        <p className="font-medium leading-5">{purchase.supplierName}</p>
                        <p className="text-xs text-muted-foreground">
                          {purchase.taxMode === "with_vat" ? "Con IVA 21%" : "Sin IVA"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <div className="flex min-h-11 items-center">
                        <Badge variant={statusVariant(purchase.status)}>
                          {formatStatusLabel(purchase.status)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      {purchase.jobId ? (
                        <Badge variant="outline">{purchase.jobId.slice(0, 8)}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin job</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right font-medium">
                      {formatMoney(purchase.subtotalNet)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right">
                      {formatMoney(purchase.vatAmount)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right font-medium">
                      {formatMoney(purchase.totalGross)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <div className="space-y-1 text-sm leading-5">
                        <p>{purchase.items.length} item{purchase.items.length === 1 ? "" : "s"}</p>
                        <p className="text-xs text-muted-foreground">
                          {summarizeItems(purchase)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right">
                      {purchase.status !== "received" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void markAsReceived(purchase.id)}
                        >
                          Marcar recibido
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin acciones</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!loading && purchases.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No hay compras registradas.
            </p>
          ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
