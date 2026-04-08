"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { apiGet, apiPost } from "@/features/admin/api";

type StockItemKind = "frame" | "glass" | "matboard";
type StockMovementType =
  | "opening_balance"
  | "purchase_received"
  | "job_consumption"
  | "manual_adjustment"
  | "manual_reversal";

type StockItem = {
  id: string;
  kind: StockItemKind;
  unit: "m" | "m2";
  displayName: string;
  active: boolean;
  onHandQuantity: number;
  updatedAt: string | null;
  suggestedCostPerUnit: number;
  lastReceivedCostPerUnit: number | null;
  referenceCostPerUnit: number;
  deviationVsReferencePct: number;
  purchaseCountWindow: number;
};

type StockMovement = {
  id: string;
  catalogItemId: string;
  catalogItemName: string | null;
  catalogItemKind: StockItemKind | null;
  catalogItemUnit: "m" | "m2" | null;
  movementType: StockMovementType;
  quantityDelta: number;
  unitCost: number | null;
  totalCost: number | null;
  purchaseId: string | null;
  purchaseSupplierName: string | null;
  purchaseStatus: string | null;
  purchaseTotalCost: number | null;
  purchaseTotalGross: number | null;
  purchaseItemId: string | null;
  jobId: string | null;
  jobStatus: string | null;
  notes: string | null;
  occurredAt: string;
};

type StockPayload = {
  items: StockItem[];
  movements: StockMovement[];
};

type KindFilter = "all" | StockItemKind;
type MovementFilter = "all" | StockMovementType;

const movementTypeOptions: Array<{ value: MovementFilter; label: string }> = [
  { value: "all", label: "Todos los movimientos" },
  { value: "purchase_received", label: "Compra recibida" },
  { value: "job_consumption", label: "Consumo de job" },
  { value: "manual_adjustment", label: "Ajuste manual" },
  { value: "manual_reversal", label: "Reversa manual" },
  { value: "opening_balance", label: "Saldo inicial" },
];

function formatMoney(value: number | null, digits = 2) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return `$${value.toFixed(digits)}`;
}

function formatQty(value: number, unit: string) {
  return `${value.toFixed(4)} ${unit}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("es-AR");
}

function looksLikeUuid(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function kindLabel(kind: StockItemKind | null) {
  if (kind === "frame") {
    return "Marco";
  }

  if (kind === "glass") {
    return "Vidrio";
  }

  if (kind === "matboard") {
    return "Paspartu";
  }

  return "Sin tipo";
}

function movementLabel(type: StockMovementType) {
  if (type === "purchase_received") {
    return "Compra recibida";
  }

  if (type === "job_consumption") {
    return "Consumo job";
  }

  if (type === "manual_adjustment") {
    return "Ajuste manual";
  }

  if (type === "manual_reversal") {
    return "Reversa manual";
  }

  return "Saldo inicial";
}

function movementBadgeVariant(type: StockMovementType) {
  if (type === "purchase_received") {
    return "default" as const;
  }

  if (type === "job_consumption") {
    return "secondary" as const;
  }

  if (type === "manual_adjustment" || type === "manual_reversal") {
    return "outline" as const;
  }

  return "ghost" as const;
}

function itemLabel(item: Pick<StockItem, "displayName" | "id" | "kind" | "unit">) {
  const displayName = item.displayName.trim();
  const safeName =
    displayName.length > 0 && !looksLikeUuid(displayName)
      ? displayName
      : `${kindLabel(item.kind)} ${item.id.slice(0, 8)}`;

  return `${safeName} (${item.unit})`;
}

function movementItemLabel(movement: StockMovement) {
  const displayName = movement.catalogItemName?.trim();

  if (displayName && !looksLikeUuid(displayName)) {
    return displayName;
  }

  return `${kindLabel(movement.catalogItemKind)} ${movement.catalogItemId.slice(0, 8)}`;
}

function kindBadgeVariant(kind: StockItemKind | null) {
  if (kind === "frame") {
    return "default" as const;
  }

  if (kind === "glass") {
    return "secondary" as const;
  }

  return "outline" as const;
}

function buildMovementReference(movement: StockMovement) {
  if (movement.purchaseId) {
    const supplierName =
      movement.purchaseSupplierName && !looksLikeUuid(movement.purchaseSupplierName)
        ? movement.purchaseSupplierName
        : null;
    const supplierSegment = supplierName ? ` · ${supplierName}` : "";

    return `Compra ${movement.purchaseId.slice(0, 8)}${supplierSegment}`;
  }

  if (movement.jobId) {
    const statusSegment = movement.jobStatus ? ` · ${movement.jobStatus}` : "";
    return `Job ${movement.jobId.slice(0, 8)}${statusSegment}`;
  }

  return movement.notes ?? "-";
}

function matchesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search);
}

export default function AdminStockPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantityDelta, setQuantityDelta] = useState("0");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const [itemSearch, setItemSearch] = useState("");
  const [movementSearch, setMovementSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all");
  const [positiveOnly, setPositiveOnly] = useState(true);

  const deferredItemSearch = useDeferredValue(itemSearch.trim().toLowerCase());
  const deferredMovementSearch = useDeferredValue(movementSearch.trim().toLowerCase());

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        setLoading(true);
        const payload = await apiGet<StockPayload>("/api/admin/stock");

        if (ignore) {
          return;
        }

        setItems(payload.items);
        setMovements(payload.movements);
        setSelectedItemId((current) => {
          if (payload.items.some((item) => item.id === current)) {
            return current;
          }

          const firstActiveItem = payload.items.find((item) => item.active);
          return firstActiveItem?.id ?? "";
        });
        setError(null);
      } catch (loadError) {
        if (ignore) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Error inesperado.");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  const activeItems = useMemo(
    () => items.filter((item) => item.active),
    [items],
  );

  const selectedItem = useMemo(
    () => itemById.get(selectedItemId) ?? null,
    [itemById, selectedItemId],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (kindFilter !== "all" && item.kind !== kindFilter) {
          return false;
        }

        if (positiveOnly && item.onHandQuantity <= 0) {
          return false;
        }

        if (deferredItemSearch.length === 0) {
          return true;
        }

        return matchesSearch(itemLabel(item), deferredItemSearch);
      }),
    [items, kindFilter, positiveOnly, deferredItemSearch],
  );

  const filteredMovements = useMemo(
    () =>
      movements.filter((movement) => {
        if (kindFilter !== "all" && movement.catalogItemKind !== kindFilter) {
          return false;
        }

        if (movementFilter !== "all" && movement.movementType !== movementFilter) {
          return false;
        }

        if (deferredMovementSearch.length === 0) {
          return true;
        }

        return (
          matchesSearch(movementItemLabel(movement), deferredMovementSearch) ||
          matchesSearch(buildMovementReference(movement), deferredMovementSearch) ||
          matchesSearch(movementLabel(movement.movementType), deferredMovementSearch)
        );
      }),
    [movements, kindFilter, movementFilter, deferredMovementSearch],
  );

  const stockSummary = useMemo(() => {
    const positiveItems = items.filter((item) => item.onHandQuantity > 0);

    return {
      itemsWithStock: positiveItems.length,
      frameMeters: positiveItems
        .filter((item) => item.kind === "frame")
        .reduce((acc, item) => acc + item.onHandQuantity, 0),
      glassSquareMeters: positiveItems
        .filter((item) => item.kind === "glass")
        .reduce((acc, item) => acc + item.onHandQuantity, 0),
      matboardSquareMeters: positiveItems
        .filter((item) => item.kind === "matboard")
        .reduce((acc, item) => acc + item.onHandQuantity, 0),
    };
  }, [items]);

  const latestReceivedMovement = useMemo(
    () => movements.find((movement) => movement.movementType === "purchase_received") ?? null,
    [movements],
  );

  async function submitAdjustment() {
    if (!selectedItemId) {
      setError("Selecciona un item para ajustar stock.");
      return;
    }

    const parsedDelta = Number(quantityDelta);

    if (!Number.isFinite(parsedDelta) || parsedDelta === 0) {
      setError("quantityDelta debe ser un numero distinto de 0.");
      return;
    }

    const parsedUnitCost = unitCost.trim() === "" ? null : Number(unitCost);

    if (parsedUnitCost !== null && (!Number.isFinite(parsedUnitCost) || parsedUnitCost < 0)) {
      setError("unitCost debe ser mayor o igual a 0.");
      return;
    }

    try {
      setAdjusting(true);
      setError(null);

      await apiPost("/api/admin/stock/adjustments", {
        catalogItemId: selectedItemId,
        quantityDelta: parsedDelta,
        unitCost: parsedUnitCost,
        notes: notes.trim() || null,
      });

      setQuantityDelta("0");
      setUnitCost("");
      setNotes("");
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error inesperado.");
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <div className="space-y-4">

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Items con saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stockSummary.itemsWithStock}</p>
            <p className="text-xs text-muted-foreground">Catalogos con stock disponible ahora.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Marcos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stockSummary.frameMeters.toFixed(4)} m</p>
            <p className="text-xs text-muted-foreground">Metros lineales disponibles.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Vidrios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stockSummary.glassSquareMeters.toFixed(4)} m2</p>
            <p className="text-xs text-muted-foreground">Superficie disponible en stock.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Paspartu</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {stockSummary.matboardSquareMeters.toFixed(4)} m2
            </p>
            <p className="text-xs text-muted-foreground">Superficie disponible en stock.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ajuste manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <Select
                value={selectedItemId}
                onValueChange={(value) => setSelectedItemId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Item de catalogo">
                    {(value) => {
                      const selected = typeof value === "string" ? value : null;

                      if (!selected) {
                        return "Item de catalogo";
                      }

                      const item = itemById.get(selected);
                      return item ? itemLabel(item) : "Item de catalogo";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {itemLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={quantityDelta}
                onChange={(event) => setQuantityDelta(event.target.value)}
                placeholder="Delta cantidad"
                inputMode="decimal"
              />
            </div>

            <div className="grid gap-2 md:grid-cols-[220px_1fr]">
              <Input
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
                placeholder="Costo unitario (opcional)"
                inputMode="decimal"
              />
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notas"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={submitAdjustment} disabled={adjusting}>
                {adjusting ? "Guardando..." : "Aplicar ajuste"}
              </Button>
              {selectedItem ? (
                <p className="text-xs text-muted-foreground">
                  Saldo actual: {formatQty(selectedItem.onHandQuantity, selectedItem.unit)}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Lectura rapida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Item seleccionado:{" "}
              <span className="font-medium">
                {selectedItem ? itemLabel(selectedItem) : "-"}
              </span>
            </p>
            <p>
              Ultimo costo recibido:{" "}
              <span className="font-medium">
                {selectedItem ? formatMoney(selectedItem.lastReceivedCostPerUnit, 4) : "-"}
              </span>
            </p>
            <p>
              Costo sugerido:{" "}
              <span className="font-medium">
                {selectedItem ? formatMoney(selectedItem.suggestedCostPerUnit, 4) : "-"}
              </span>
            </p>
            <p>
              Desvio vs referencia:{" "}
              <span
                className={
                  selectedItem && Math.abs(selectedItem.deviationVsReferencePct) >= 20
                    ? "font-medium text-amber-700"
                    : "font-medium"
                }
              >
                {selectedItem ? `${selectedItem.deviationVsReferencePct.toFixed(2)}%` : "-"}
              </span>
            </p>
            <p>
              Actualizado:{" "}
              <span className="font-medium">
                {selectedItem ? formatDate(selectedItem.updatedAt) : "-"}
              </span>
            </p>
            <p>
              Ultima recepcion:{" "}
              <span className="font-medium">
                {latestReceivedMovement
                  ? `${movementItemLabel(latestReceivedMovement)} · ${formatDate(latestReceivedMovement.occurredAt)}`
                  : "-"}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Saldos y costos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={itemSearch}
              onChange={(event) => setItemSearch(event.target.value)}
              className="min-w-[260px]"
              placeholder="Buscar item"
            />

            <Select
              value={kindFilter}
              onValueChange={(value) => setKindFilter((value ?? "all") as KindFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="frame">Marcos</SelectItem>
                <SelectItem value="glass">Vidrios</SelectItem>
                <SelectItem value="matboard">Paspartu</SelectItem>
              </SelectContent>
            </Select>

            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={positiveOnly}
                onCheckedChange={(value) => setPositiveOnly(!!value)}
              />
              Mostrar solo saldo positivo
            </label>
          </div>

          {loading ? (
            <TableSkeleton columns={8} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs text-muted-foreground">
                  <TableHead>Item</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Ult. costo compra</TableHead>
                  <TableHead>Costo ref</TableHead>
                  <TableHead>Costo sugerido</TableHead>
                  <TableHead>Desvio</TableHead>
                  <TableHead>Actualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{itemLabel(item)}</TableCell>
                    <TableCell>
                      <Badge variant={kindBadgeVariant(item.kind)}>{kindLabel(item.kind)}</Badge>
                    </TableCell>
                    <TableCell>{formatQty(item.onHandQuantity, item.unit)}</TableCell>
                    <TableCell>{formatMoney(item.lastReceivedCostPerUnit, 4)}</TableCell>
                    <TableCell>{formatMoney(item.referenceCostPerUnit, 4)}</TableCell>
                    <TableCell>{formatMoney(item.suggestedCostPerUnit, 4)}</TableCell>
                    <TableCell
                      className={
                        Math.abs(item.deviationVsReferencePct) >= 20
                          ? "font-medium text-amber-700"
                          : undefined
                      }
                    >
                      {item.deviationVsReferencePct.toFixed(2)}%
                    </TableCell>
                    <TableCell>{formatDate(item.updatedAt)}</TableCell>
                  </TableRow>
                ))}

                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-sm text-muted-foreground">
                      No hay items que coincidan con los filtros actuales.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Movimientos recientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={movementSearch}
              onChange={(event) => setMovementSearch(event.target.value)}
              className="min-w-[260px]"
              placeholder="Buscar por item, compra o job"
            />

            <Select
              value={movementFilter}
              onValueChange={(value) => setMovementFilter((value ?? "all") as MovementFilter)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Movimiento" />
              </SelectTrigger>
              <SelectContent>
                {movementTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <TableSkeleton columns={7} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs text-muted-foreground">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Movimiento</TableHead>
                  <TableHead>Delta</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Nota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{formatDate(movement.occurredAt)}</TableCell>
                    <TableCell className="font-medium">{movementItemLabel(movement)}</TableCell>
                    <TableCell>
                      <Badge variant={movementBadgeVariant(movement.movementType)}>
                        {movementLabel(movement.movementType)}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={movement.quantityDelta >= 0 ? "text-emerald-700" : "text-rose-700"}
                    >
                      {movement.quantityDelta > 0 ? "+" : ""}
                      {movement.quantityDelta.toFixed(4)} {movement.catalogItemUnit ?? ""}
                    </TableCell>
                    <TableCell>
                      {movement.unitCost === null
                        ? "-"
                        : `${formatMoney(movement.unitCost, 4)} / ${movement.catalogItemUnit ?? "u"}`}
                    </TableCell>
                    <TableCell>{buildMovementReference(movement)}</TableCell>
                    <TableCell>{movement.notes ?? "-"}</TableCell>
                  </TableRow>
                ))}

                {filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      No hay movimientos para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
