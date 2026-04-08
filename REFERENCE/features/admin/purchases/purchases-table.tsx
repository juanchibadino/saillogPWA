"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import type { PurchaseRecord, PurchaseStatus } from "@/features/admin/purchases/types";

type PurchasesTableProps = {
  purchases: PurchaseRecord[];
  loading?: boolean;
  emptyMessage?: string;
  onMarkReceived?: (purchaseId: string) => void | Promise<void>;
  receivingPurchaseId?: string | null;
};

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

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatStatusLabel(status: PurchaseStatus) {
  if (status === "draft") {
    return "Draft";
  }

  if (status === "ordered") {
    return "Ordered";
  }

  if (status === "received") {
    return "Received";
  }

  return "Cancelled";
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

export function PurchasesTable({
  purchases,
  loading = false,
  emptyMessage = "No purchases found.",
  onMarkReceived,
  receivingPurchaseId = null,
}: PurchasesTableProps) {
  if (loading) {
    return <TableSkeleton columns={9} />;
  }

  return (
    <>
      <Table>
        <TableHeader className="bg-muted">
          <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
            <TableHead className="h-10 px-3">Purchase</TableHead>
            <TableHead className="h-10 px-3">Supplier</TableHead>
            <TableHead className="h-10 px-3">Status</TableHead>
            <TableHead className="h-10 px-3">Job</TableHead>
            <TableHead className="h-10 px-3 text-right">Net</TableHead>
            <TableHead className="h-10 px-3 text-right">VAT</TableHead>
            <TableHead className="h-10 px-3 text-right">Total</TableHead>
            <TableHead className="h-10 px-3">Items</TableHead>
            <TableHead className="h-10 w-40 px-3 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map((purchase) => (
            <TableRow key={purchase.id}>
              <TableCell className="px-3 py-2.5">
                <div className="space-y-1">
                  <p className="font-medium leading-5">#{purchase.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDate(purchase.createdAt)}
                  </p>
                </div>
              </TableCell>
              <TableCell className="px-3 py-2.5">
                <div className="space-y-1 text-sm leading-5">
                  <p className="font-medium leading-5">{purchase.supplierName}</p>
                  <p className="text-xs text-muted-foreground">
                    {purchase.taxMode === "with_vat" ? "VAT 21%" : "No VAT"}
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
                  <span className="text-sm text-muted-foreground">No job</span>
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
                {purchase.status !== "received" && onMarkReceived ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onMarkReceived(purchase.id)}
                    disabled={receivingPurchaseId === purchase.id}
                  >
                    {receivingPurchaseId === purchase.id ? "Saving..." : "Mark received"}
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">No actions</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {purchases.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : null}
    </>
  );
}
