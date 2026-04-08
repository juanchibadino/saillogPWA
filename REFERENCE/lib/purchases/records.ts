import type { PurchaseRecord } from "@/features/admin/purchases/types";

export const PURCHASE_RECORD_SELECT =
  "id, supplier_id, supplier_name, status, total_cost, tax_mode, vat_rate, subtotal_net, vat_amount, total_gross, ordered_at, received_at, job_id, notes, created_at, purchase_items(id, catalog_item_id, catalog_frame_id, description, meters, meters_per_piece, width_cm, height_cm, quantity, quantity_base, unit_cost, total_cost, catalog_items(id, kind, unit, display_name, active))";

type PurchaseQueryRow = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  status: PurchaseRecord["status"];
  total_cost: number | string;
  tax_mode: PurchaseRecord["taxMode"] | null;
  vat_rate: number | string | null;
  subtotal_net: number | string | null;
  vat_amount: number | string | null;
  total_gross: number | string | null;
  ordered_at: string | null;
  received_at: string | null;
  job_id: string | null;
  notes?: string | null;
  created_at: string;
  purchase_items?: Array<{
    id: string;
    catalog_item_id: string | null;
    catalog_frame_id: string | null;
    description: string | null;
    meters: number | string;
    meters_per_piece: number | string | null;
    width_cm: number | string | null;
    height_cm: number | string | null;
    quantity: number | string;
    quantity_base: number | string | null;
    unit_cost: number | string;
    total_cost: number | string;
    catalog_items?:
      | {
          id: string;
          kind: "frame" | "glass" | "matboard";
          unit: "m" | "m2";
          display_name: string;
          active?: boolean;
        }
      | Array<{
          id: string;
          kind: "frame" | "glass" | "matboard";
          unit: "m" | "m2";
          display_name: string;
          active?: boolean;
        }>
      | null;
  }>;
};

export function mapPurchaseRecord(purchase: PurchaseQueryRow): PurchaseRecord {
  return {
    id: purchase.id,
    supplierId: purchase.supplier_id,
    supplierName: purchase.supplier_name,
    status: purchase.status,
    totalCost: Number(purchase.total_cost),
    taxMode: purchase.tax_mode ?? "without_vat",
    vatRate:
      purchase.vat_rate === null || purchase.vat_rate === undefined
        ? 0.21
        : Number(purchase.vat_rate),
    subtotalNet:
      purchase.subtotal_net === null || purchase.subtotal_net === undefined
        ? Number(purchase.total_cost)
        : Number(purchase.subtotal_net),
    vatAmount:
      purchase.vat_amount === null || purchase.vat_amount === undefined
        ? 0
        : Number(purchase.vat_amount),
    totalGross:
      purchase.total_gross === null || purchase.total_gross === undefined
        ? Number(purchase.total_cost)
        : Number(purchase.total_gross),
    orderedAt: purchase.ordered_at,
    receivedAt: purchase.received_at,
    jobId: purchase.job_id,
    notes: purchase.notes ?? null,
    createdAt: purchase.created_at,
    items: (purchase.purchase_items ?? []).map((item) => {
      const catalogItem = Array.isArray(item.catalog_items)
        ? item.catalog_items[0]
        : item.catalog_items;

      return {
        id: item.id,
        catalogItemId: item.catalog_item_id,
        catalogItemKind: catalogItem?.kind ?? null,
        catalogItemUnit: catalogItem?.unit ?? null,
        catalogItemName: catalogItem?.display_name ?? null,
        catalogFrameId: item.catalog_frame_id,
        description: item.description,
        meters: Number(item.meters),
        metersPerPiece:
          item.meters_per_piece === null || item.meters_per_piece === undefined
            ? null
            : Number(item.meters_per_piece),
        widthCm:
          item.width_cm === null || item.width_cm === undefined
            ? null
            : Number(item.width_cm),
        heightCm:
          item.height_cm === null || item.height_cm === undefined
            ? null
            : Number(item.height_cm),
        quantity: Number(item.quantity),
        quantityBase:
          item.quantity_base === null ? Number(item.quantity) : Number(item.quantity_base),
        unitCost: Number(item.unit_cost),
        totalCost: Number(item.total_cost),
      };
    }),
  };
}
