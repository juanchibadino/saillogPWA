"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiPost } from "@/features/admin/api";
import type {
  CreatePurchaseLinePayload,
  CreatePurchasePayload,
  PurchaseCatalogItem,
  PurchaseStatus,
  PurchaseTaxMode,
  SupplierOption,
} from "@/features/admin/purchases/types";

const VAT_RATE = 0.21;
const EMPTY_ROW_ITEM = "__none_catalog_item__";

type PurchaseFormLine = {
  id: string;
  catalogItemId: string;
  pieceCount: string;
  unitCostNet: string;
  metersPerPiece: string;
  widthCm: string;
  heightCm: string;
};

type StagedPurchaseLine = PurchaseFormLine & {
  quantityBase: number;
  totalNet: number;
  label: string;
};

export type PurchaseFormSeedLine = {
  catalogItemId: string;
  pieceCount?: number;
  unitCostNet?: number | null;
  metersPerPiece?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
};

type PurchaseFormProps = {
  suppliers: SupplierOption[];
  catalogItems: PurchaseCatalogItem[];
  fixedJobId?: string;
  initialJobId?: string;
  initialLines?: PurchaseFormSeedLine[];
  submitLabel?: string;
  onSubmitted?: () => Promise<void> | void;
  onError?: (message: string | null) => void;
};

function lineId() {
  return `line_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value.trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseNonNegativeNumber(value: string): number | null {
  const parsed = Number(value.trim());

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value.trim());

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function kindLabel(kind: PurchaseCatalogItem["kind"]) {
  if (kind === "frame") {
    return "Frame";
  }

  if (kind === "glass") {
    return "Glass";
  }

  return "Matboard";
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function formatSupplierLabel(supplier: SupplierOption) {
  const name = supplier.name.trim();
  const code = supplier.code.trim().toUpperCase();
  const normalizedName = name.replace(/\s+/g, " ").toUpperCase();
  const normalizedCode = code.replace(/\s+/g, " ");

  if (name.length > 0 && !looksLikeUuid(name)) {
    return code && normalizedName !== normalizedCode ? `${name} (${code})` : name;
  }

  if (code) {
    return `Supplier ${code}`;
  }

  return `Supplier ${supplier.id.slice(0, 8)}`;
}

function formatCatalogLabel(item: PurchaseCatalogItem) {
  const displayName = item.displayName.trim();
  const safeName =
    displayName.length > 0 && !looksLikeUuid(displayName)
      ? displayName
      : `${kindLabel(item.kind)} ${item.id.slice(0, 8)}`;

  return `${safeName} (${item.unit})`;
}

function defaultLine(catalogItems: PurchaseCatalogItem[]): PurchaseFormLine {
  return {
    id: lineId(),
    catalogItemId: catalogItems[0]?.id ?? "",
    pieceCount: "1",
    unitCostNet: "0",
    metersPerPiece: "",
    widthCm: "",
    heightCm: "",
  };
}

function computeQuantityBase(
  line: PurchaseFormLine,
  catalogItem: PurchaseCatalogItem | undefined,
) {
  if (!catalogItem) {
    return null;
  }

  const pieceCount = parsePositiveInt(line.pieceCount);

  if (!pieceCount) {
    return null;
  }

  if (catalogItem.kind === "frame") {
    const metersPerPiece = parsePositiveNumber(line.metersPerPiece);

    if (!metersPerPiece) {
      return null;
    }

    return round4(metersPerPiece * pieceCount);
  }

  const widthCm = parsePositiveNumber(line.widthCm);
  const heightCm = parsePositiveNumber(line.heightCm);

  if (!widthCm || !heightCm) {
    return null;
  }

  const squareMetersPerPiece = round4((widthCm / 100) * (heightCm / 100));
  return round4(squareMetersPerPiece * pieceCount);
}

function statusLabel(status: PurchaseStatus) {
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

function taxModeLabel(taxMode: PurchaseTaxMode) {
  return taxMode === "with_vat" ? "VAT 21%" : "No VAT";
}

function seedToDraftLine(seed: PurchaseFormSeedLine): PurchaseFormLine {
  return {
    id: lineId(),
    catalogItemId: seed.catalogItemId,
    pieceCount: String(seed.pieceCount ?? 1),
    unitCostNet:
      seed.unitCostNet === null || seed.unitCostNet === undefined
        ? "0"
        : String(seed.unitCostNet),
    metersPerPiece:
      seed.metersPerPiece === null || seed.metersPerPiece === undefined
        ? ""
        : String(seed.metersPerPiece),
    widthCm:
      seed.widthCm === null || seed.widthCm === undefined ? "" : String(seed.widthCm),
    heightCm:
      seed.heightCm === null || seed.heightCm === undefined
        ? ""
        : String(seed.heightCm),
  };
}

function buildInitialStagedLines(
  initialLines: PurchaseFormSeedLine[],
  activeCatalogItems: PurchaseCatalogItem[],
): StagedPurchaseLine[] {
  const byId = new Map(activeCatalogItems.map((item) => [item.id, item]));

  return initialLines.flatMap((seed) => {
    const line = seedToDraftLine(seed);
    const catalogItem = byId.get(line.catalogItemId);
    const quantityBase = computeQuantityBase(line, catalogItem);
    const unitCostNet = parseNonNegativeNumber(line.unitCostNet);

    if (!catalogItem || quantityBase === null || unitCostNet === null) {
      return [];
    }

    return [
      {
        ...line,
        quantityBase,
        totalNet: round2(quantityBase * unitCostNet),
        label: formatCatalogLabel(catalogItem),
      },
    ];
  });
}

export function PurchaseForm({
  suppliers,
  catalogItems,
  fixedJobId,
  initialJobId,
  initialLines = [],
  submitLabel = "Save purchase",
  onSubmitted,
  onError,
}: PurchaseFormProps) {
  const activeCatalogItems = useMemo(
    () => catalogItems.filter((item) => item.active),
    [catalogItems],
  );

  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers],
  );

  const catalogItemById = useMemo(
    () => new Map(activeCatalogItems.map((item) => [item.id, item])),
    [activeCatalogItems],
  );

  const [jobId, setJobId] = useState(fixedJobId ?? initialJobId ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<PurchaseStatus>("ordered");
  const [taxMode, setTaxMode] = useState<PurchaseTaxMode>("without_vat");
  const [draftLine, setDraftLine] = useState<PurchaseFormLine>(() =>
    defaultLine(activeCatalogItems),
  );
  const [lines, setLines] = useState<StagedPurchaseLine[]>(() =>
    buildInitialStagedLines(initialLines, activeCatalogItems),
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (fixedJobId !== undefined) {
      setJobId(fixedJobId);
    }
  }, [fixedJobId]);

  useEffect(() => {
    if (suppliers.length === 0) {
      setSupplierId("");
      return;
    }

    setSupplierId((current) =>
      suppliers.some((supplier) => supplier.id === current)
        ? current
        : suppliers[0].id,
    );
  }, [suppliers]);

  useEffect(() => {
    if (activeCatalogItems.length === 0) {
      setDraftLine(defaultLine([]));
      setLines([]);
      return;
    }

    setDraftLine((current) => {
      if (catalogItemById.has(current.catalogItemId)) {
        return current;
      }

      if (initialLines.length > 0) {
        const seededDraft = seedToDraftLine(initialLines[0]);

        if (catalogItemById.has(seededDraft.catalogItemId)) {
          return seededDraft;
        }
      }

      return { ...defaultLine(activeCatalogItems), id: current.id || lineId() };
    });

    setLines((current) => {
      if (current.length > 0) {
        return current.filter((line) => catalogItemById.has(line.catalogItemId));
      }

      return buildInitialStagedLines(initialLines, activeCatalogItems);
    });
  }, [activeCatalogItems, catalogItemById, initialLines]);

  useEffect(() => {
    onError?.(formError);
  }, [formError, onError]);

  const subtotalNet = round2(lines.reduce((acc, line) => acc + line.totalNet, 0));
  const vatAmount = taxMode === "with_vat" ? round2(subtotalNet * VAT_RATE) : 0;
  const totalGross = round2(subtotalNet + vatAmount);

  const draftCatalogItem = catalogItemById.get(draftLine.catalogItemId);
  const draftQuantityBase = computeQuantityBase(draftLine, draftCatalogItem);
  const draftUnitCostNet = parseNonNegativeNumber(draftLine.unitCostNet);
  const draftTotalNet =
    draftQuantityBase === null || draftUnitCostNet === null
      ? null
      : round2(draftQuantityBase * draftUnitCostNet);

  function updateDraftLine(patch: Partial<PurchaseFormLine>) {
    setDraftLine((current) => ({
      ...current,
      ...patch,
    }));
  }

  function resetDraftLine() {
    setDraftLine(defaultLine(activeCatalogItems));
  }

  function addDraftLine() {
    if (!draftCatalogItem) {
      setFormError("Select a valid catalog item.");
      return;
    }

    const pieceCount = parsePositiveInt(draftLine.pieceCount);

    if (!pieceCount) {
      setFormError("Piece count must be an integer greater than 0.");
      return;
    }

    const unitCostNet = parseNonNegativeNumber(draftLine.unitCostNet);

    if (unitCostNet === null) {
      setFormError("Unit net cost is invalid.");
      return;
    }

    if (draftCatalogItem.kind === "frame") {
      const metersPerPiece = parsePositiveNumber(draftLine.metersPerPiece);

      if (!metersPerPiece) {
        setFormError("Meters per piece must be greater than 0.");
        return;
      }
    } else {
      const widthCm = parsePositiveNumber(draftLine.widthCm);
      const heightCm = parsePositiveNumber(draftLine.heightCm);

      if (!widthCm || !heightCm) {
        setFormError("Width and height must be greater than 0.");
        return;
      }
    }

    if (draftQuantityBase === null || draftTotalNet === null) {
      setFormError("The base quantity or net total could not be calculated.");
      return;
    }

    setLines((current) => [
      ...current,
      {
        ...draftLine,
        quantityBase: draftQuantityBase,
        totalNet: draftTotalNet,
        label: formatCatalogLabel(draftCatalogItem),
      },
    ]);
    setFormError(null);
    resetDraftLine();
  }

  function removeLine(lineIdToRemove: string) {
    setLines((current) => current.filter((line) => line.id !== lineIdToRemove));
  }

  async function submitPurchase() {
    if (!supplierId) {
      setFormError("Select a supplier before saving the purchase.");
      return;
    }

    if (lines.length === 0) {
      setFormError("Add at least one item before saving the purchase.");
      return;
    }

    const linePayload: CreatePurchaseLinePayload[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const row = lines[index];
      const lineNumber = index + 1;
      const catalogItem = catalogItemById.get(row.catalogItemId);

      if (!catalogItem) {
        setFormError(`Line ${lineNumber}: select a valid catalog item.`);
        return;
      }

      const pieceCount = parsePositiveInt(row.pieceCount);

      if (!pieceCount) {
        setFormError(`Line ${lineNumber}: piece count must be greater than 0.`);
        return;
      }

      const unitCostNet = parseNonNegativeNumber(row.unitCostNet);

      if (unitCostNet === null) {
        setFormError(`Line ${lineNumber}: invalid unit net cost.`);
        return;
      }

      if (catalogItem.kind === "frame") {
        const metersPerPiece = parsePositiveNumber(row.metersPerPiece);

        if (!metersPerPiece) {
          setFormError(`Line ${lineNumber}: meters per piece must be greater than 0.`);
          return;
        }

        linePayload.push({
          catalogItemId: catalogItem.id,
          pieceCount,
          unitCostNet,
          metersPerPiece,
        });
        continue;
      }

      const widthCm = parsePositiveNumber(row.widthCm);
      const heightCm = parsePositiveNumber(row.heightCm);

      if (!widthCm || !heightCm) {
        setFormError(`Line ${lineNumber}: width and height must be greater than 0.`);
        return;
      }

      linePayload.push({
        catalogItemId: catalogItem.id,
        pieceCount,
        unitCostNet,
        widthCm,
        heightCm,
      });
    }

    const payload: CreatePurchasePayload = {
      jobId: (fixedJobId ?? jobId).trim() === "" ? null : (fixedJobId ?? jobId).trim(),
      supplierId,
      status,
      taxMode,
      vatRate: VAT_RATE,
      items: linePayload,
    };

    try {
      setSubmitting(true);
      setFormError(null);
      await apiPost("/api/admin/purchases", payload);
      if (fixedJobId === undefined) {
        setJobId("");
      }
      setLines([]);
      resetDraftLine();
      await onSubmitted?.();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={supplierId} onValueChange={(value) => setSupplierId(value ?? "")}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Supplier">
                {(value) => {
                  const selected = typeof value === "string" ? value : null;

                  if (!selected) {
                    return "Supplier";
                  }

                  const supplier = supplierById.get(selected);
                  return supplier ? formatSupplierLabel(supplier) : "Supplier";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {formatSupplierLabel(supplier)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(value) => setStatus(value as PurchaseStatus)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status">
                {(value) => {
                  const selected = typeof value === "string" ? (value as PurchaseStatus) : null;
                  return selected ? statusLabel(selected) : "Status";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={taxMode}
            onValueChange={(value) => setTaxMode(value as PurchaseTaxMode)}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Tax mode">
                {(value) => {
                  const selected = typeof value === "string" ? (value as PurchaseTaxMode) : null;
                  return selected ? taxModeLabel(selected) : "Tax mode";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="without_vat">No VAT</SelectItem>
              <SelectItem value="with_vat">VAT 21%</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="button" onClick={submitPurchase} disabled={submitting || lines.length === 0}>
          {submitting ? "Saving..." : submitLabel}
        </Button>
      </div>

      {fixedJobId === undefined ? (
        <Input
          value={jobId}
          onChange={(event) => setJobId(event.target.value)}
          className="max-w-[280px]"
          placeholder="job_id (optional)"
        />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
              <TableHead className="h-10 px-3">Catalog item</TableHead>
              <TableHead className="h-10 px-3">Dimensions</TableHead>
              <TableHead className="h-10 px-3">Pieces</TableHead>
              <TableHead className="h-10 px-3">Net unit cost</TableHead>
              <TableHead className="h-10 px-3">Base quantity</TableHead>
              <TableHead className="h-10 px-3">Net total</TableHead>
              <TableHead className="h-10 px-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const lineCatalogItem = catalogItemById.get(line.catalogItemId);

              return (
                <TableRow key={line.id}>
                  <TableCell className="px-3 py-2.5 font-medium">{line.label}</TableCell>
                  <TableCell className="px-3 py-2.5">
                    {lineCatalogItem?.kind === "frame"
                      ? `${line.metersPerPiece} m per piece`
                      : `${line.widthCm} x ${line.heightCm} cm`}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">{line.pieceCount}</TableCell>
                  <TableCell className="px-3 py-2.5">
                    {formatMoney(Number(line.unitCostNet))}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">{line.quantityBase.toFixed(4)}</TableCell>
                  <TableCell className="px-3 py-2.5">{formatMoney(line.totalNet)}</TableCell>
                  <TableCell className="px-3 py-2.5 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeLine(line.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {activeCatalogItems.length > 0 ? (
              <TableRow>
                <TableCell className="px-3 py-2.5">
                  <Select
                    value={draftLine.catalogItemId || EMPTY_ROW_ITEM}
                    onValueChange={(value) => {
                      if (!value || value === EMPTY_ROW_ITEM) {
                        return;
                      }

                      updateDraftLine({
                        catalogItemId: value,
                        metersPerPiece: "",
                        widthCm: "",
                        heightCm: "",
                      });
                    }}
                  >
                    <SelectTrigger className="w-[380px]">
                      <SelectValue placeholder="Catalog item">
                        {(value) => {
                          const selected = typeof value === "string" ? value : null;

                          if (!selected || selected === EMPTY_ROW_ITEM) {
                            return "Catalog item";
                          }

                          const item = catalogItemById.get(selected);
                          return item ? formatCatalogLabel(item) : "Catalog item";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {activeCatalogItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {formatCatalogLabel(item)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  {draftCatalogItem?.kind === "frame" ? (
                    <Input
                      value={draftLine.metersPerPiece}
                      onChange={(event) =>
                        updateDraftLine({ metersPerPiece: event.target.value })
                      }
                      className="w-[180px]"
                      placeholder="m per piece"
                      inputMode="decimal"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        value={draftLine.widthCm}
                        onChange={(event) => updateDraftLine({ widthCm: event.target.value })}
                        className="w-[140px]"
                        placeholder="Width cm"
                        inputMode="decimal"
                      />
                      <Input
                        value={draftLine.heightCm}
                        onChange={(event) => updateDraftLine({ heightCm: event.target.value })}
                        className="w-[140px]"
                        placeholder="Height cm"
                        inputMode="decimal"
                      />
                    </div>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <Input
                    value={draftLine.pieceCount}
                    onChange={(event) => updateDraftLine({ pieceCount: event.target.value })}
                    className="w-[120px]"
                    placeholder="Pieces"
                    inputMode="numeric"
                  />
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <Input
                    value={draftLine.unitCostNet}
                    onChange={(event) => updateDraftLine({ unitCostNet: event.target.value })}
                    className="w-[180px]"
                    placeholder="0"
                    inputMode="decimal"
                  />
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  {draftQuantityBase === null ? "-" : draftQuantityBase.toFixed(4)}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  {draftTotalNet === null ? "-" : formatMoney(draftTotalNet)}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-right">
                  <Button type="button" variant="outline" size="sm" onClick={addDraftLine}>
                    Add
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="px-3 py-6 text-sm text-muted-foreground">
                  No active catalog items available for purchases.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <div className="space-y-1 text-right">
          <p className="text-sm">
            Net subtotal: <span className="font-medium">{formatMoney(subtotalNet)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            VAT (21%): {formatMoney(vatAmount)}
          </p>
          <p className="text-lg font-semibold">{`Total: ${formatMoney(totalGross)}`}</p>
        </div>
      </div>

      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
    </div>
  );
}
