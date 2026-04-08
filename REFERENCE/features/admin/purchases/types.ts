export type PurchaseStatus = "draft" | "ordered" | "received" | "cancelled";

export type PurchaseTaxMode = "without_vat" | "with_vat";

export type SupplierOption = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export type PurchaseCatalogItemKind = "frame" | "glass" | "matboard";

export type PurchaseCatalogItem = {
  id: string;
  kind: PurchaseCatalogItemKind;
  unit: "m" | "m2";
  displayName: string;
  active: boolean;
  catalogFrameId: string | null;
  suggestedCostPerUnit?: number;
  onHandQuantity?: number;
};

export type PurchaseStockPayload = {
  items: PurchaseCatalogItem[];
};

export type PurchaseItemRecord = {
  id: string;
  catalogItemId: string | null;
  catalogItemKind: PurchaseCatalogItemKind | null;
  catalogItemUnit: "m" | "m2" | null;
  catalogItemName: string | null;
  catalogFrameId: string | null;
  description: string | null;
  meters: number;
  metersPerPiece: number | null;
  widthCm: number | null;
  heightCm: number | null;
  quantity: number;
  quantityBase: number;
  unitCost: number;
  totalCost: number;
};

export type PurchaseRecord = {
  id: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseStatus;
  totalCost: number;
  taxMode: PurchaseTaxMode;
  vatRate: number;
  subtotalNet: number;
  vatAmount: number;
  totalGross: number;
  orderedAt: string | null;
  receivedAt: string | null;
  jobId: string | null;
  notes: string | null;
  createdAt: string;
  items: PurchaseItemRecord[];
};

export type CreatePurchaseLinePayload = {
  catalogItemId: string;
  pieceCount: number;
  unitCostNet: number;
  metersPerPiece?: number;
  widthCm?: number;
  heightCm?: number;
};

export type CreatePurchasePayload = {
  jobId?: string | null;
  supplierId: string;
  status: PurchaseStatus;
  taxMode: PurchaseTaxMode;
  vatRate: number;
  items: CreatePurchaseLinePayload[];
};
