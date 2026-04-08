"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  COLOR_GROUP_LABELS,
  STYLE_LABELS,
  WOOD_LABELS,
  type ColorGroup,
  type StyleType,
  type WoodType,
} from "@/lib/catalog/taxonomy";
import type { AssemblyMode, BastidorVariant } from "@/types/domain";
import { apiGet, apiPatch, apiPost } from "@/features/admin/api";

type QuoteDetail = {
  id: string;
  leadId: string;
  jobId: string | null;
  status: string;
  subtotal: number;
  total: number;
  createdAt: string;
  approvedAt: string | null;
  items: Array<{
    id: string;
    leadItemId: string;
    frameCatalogId: string;
    unitPrice: number;
    unitProjectedCost: number;
    unitProjectedMargin: number;
    quantity: number;
    widthCm: number | null;
    heightCm: number | null;
    hasGlass: boolean;
    hasMatboard: boolean;
    glassTypeId: string | null;
    matboardTypeId: string | null;
    requestedWoodType: string | null;
    requestedStyleType: StyleType | null;
    requestedColorGroup: ColorGroup | null;
    requestedFinishColorHex: string | null;
    requestedFinishColorName: string | null;
    requestedFaceMm: number | null;
    requestedDepthMm: number | null;
    assemblyMode: AssemblyMode;
    bastidorVariant: BastidorVariant | null;
    bastidorLightCm: number | null;
    bastidorSecondaryFrameCatalogId: string | null;
    bastidorSupportMm: number | null;
    bastidorLomoMm: number | null;
    bastidorDepthMm: number | null;
    requiredMouldingCm: number | null;
    requiredMouldingM: number | null;
    perimeterCm: number | null;
    glassTypeName: string | null;
    glassCostPerSquareM: number | null;
    matboardTypeName: string | null;
    matboardCostPerSquareM: number | null;
    laborCostPerCm: number;
    unitAutoPrice: number | null;
    unitAutoCost: number | null;
    pricingSource: "calculated" | "manual_edit" | "unknown";
    selectedFrame: {
      id: string;
      label: string;
      woodType: string;
      styleType: StyleType;
      colorGroup: ColorGroup;
      faceMm: number;
      depthMm: number;
      referencePricePerMeter: number;
      referenceCostPerMeter: number;
      active: boolean;
      supportsBastidor: boolean;
      lomoMm: number | null;
    } | null;
    selectedSecondaryFrame: {
      id: string;
      label: string;
      woodType: string;
      styleType: StyleType;
      colorGroup: ColorGroup;
      faceMm: number;
      depthMm: number;
      referencePricePerMeter: number;
      referenceCostPerMeter: number;
      active: boolean;
      supportsBastidor: boolean;
      lomoMm: number | null;
    } | null;
  }>;
  activeFrames: Array<{
    id: string;
    woodType: string;
    styleType: StyleType;
    colorGroup: ColorGroup;
    faceMm: number;
    depthMm: number;
    supportsBastidor: boolean;
    lomoMm: number | null;
    label: string | null;
  }>;
};

type PriceEditDraft = {
  unitPrice: string;
  unitProjectedCost: string;
};

type OverrideSelection = {
  frameCatalogId: string;
  bastidorSecondaryFrameId: string | null;
};

type QuoteAvailability = {
  quoteId: string;
  hasShortage: boolean;
  items: Array<{
    catalogItemId: string;
    catalogItemName: string | null;
    unit: "m" | "m2" | null;
    requiredQuantity: number;
    availableQuantity: number;
    shortageQuantity: number;
    needsPurchase: boolean;
  }>;
};

function titleize(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function styleLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  return STYLE_LABELS[value as StyleType] ?? titleize(value);
}

function woodLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  return WOOD_LABELS[value as WoodType] ?? titleize(value);
}

function colorLabel(value: ColorGroup | null) {
  if (!value) {
    return "-";
  }

  return COLOR_GROUP_LABELS[value];
}

function parseNonNegativeNumber(rawValue: string, fieldName: string) {
  const value = Number(rawValue.trim());

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} debe ser un numero mayor o igual a 0.`);
  }

  return value;
}

function formatMoney(value: number | null, digits = 2) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return `$${value.toFixed(digits)}`;
}

function assemblyLabel(mode: AssemblyMode, variant: BastidorVariant | null) {
  if (mode !== "bastidor") {
    return "Normal";
  }

  return variant === "double_profile" ? "Bastidor dos varillas" : "Bastidor simple";
}

function buildInitialOverrideSelection(item: QuoteDetail["items"][number]): OverrideSelection {
  return {
    frameCatalogId: item.frameCatalogId,
    bastidorSecondaryFrameId:
      item.bastidorSecondaryFrameCatalogId ?? item.selectedSecondaryFrame?.id ?? null,
  };
}

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const quoteId = params.id;

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectionByItem, setSelectionByItem] = useState<Record<string, OverrideSelection>>({});
  const [jobResult, setJobResult] = useState<{ jobId: string } | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PriceEditDraft | null>(null);
  const [availability, setAvailability] = useState<QuoteAvailability | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function run() {
      try {
        const [payload, availabilityPayload] = await Promise.all([
          apiGet<QuoteDetail>(`/api/admin/quotes/${quoteId}`),
          apiGet<QuoteAvailability>(`/api/admin/quotes/${quoteId}/availability`),
        ]);

        if (ignore) {
          return;
        }

        setQuote(payload);
        setAvailability(availabilityPayload);
        setSelectionByItem(
          Object.fromEntries(
            payload.items.map((item) => [item.id, buildInitialOverrideSelection(item)]),
          ),
        );
        setJobResult(payload.jobId ? { jobId: payload.jobId } : null);
        setEditingItemId(null);
        setEditDraft(null);
        setError(null);
      } catch (loadError) {
        if (ignore) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Error inesperado.");
      }
    }

    void run();

    return () => {
      ignore = true;
    };
  }, [quoteId, refreshKey]);

  const frameLabelById = useMemo(
    () =>
      Object.fromEntries(
        (quote?.activeFrames ?? []).map((frame) => [
          frame.id,
          `${frame.label ?? `${woodLabel(frame.woodType)} ${frame.faceMm}x${frame.depthMm}`} | ${styleLabel(frame.styleType)} | ${colorLabel(frame.colorGroup)}${frame.supportsBastidor && frame.lomoMm !== null ? ` | bastidor ${frame.lomoMm.toFixed(1)}mm` : ""}`,
        ]),
      ),
    [quote],
  );

  const isFinalized =
    quote?.status === "quote_approved" || quote?.status === "quote_rejected";

  async function overrideFrame(quoteItemId: string) {
    const item = quote?.items.find((quoteItem) => quoteItem.id === quoteItemId);
    const selection = selectionByItem[quoteItemId];

    if (!item || !selection?.frameCatalogId) {
      return;
    }

    try {
      const payload: Record<string, string | number | null> = {
        quoteItemId,
        frameCatalogId: selection.frameCatalogId,
      };

      if (item.assemblyMode === "bastidor" && item.bastidorVariant === "double_profile") {
        payload.bastidorSecondaryFrameId = selection.bastidorSecondaryFrameId;
      }

      await apiPost(`/api/admin/quotes/${quoteId}/override-profile`, payload);
      setRefreshKey((current) => current + 1);
    } catch (overrideError) {
      setError(overrideError instanceof Error ? overrideError.message : "Error inesperado.");
    }
  }

  function startEdit(item: QuoteDetail["items"][number]) {
    setEditingItemId(item.id);
    setEditDraft({
      unitPrice: item.unitPrice.toFixed(2),
      unitProjectedCost: item.unitProjectedCost.toFixed(2),
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingItemId(null);
    setEditDraft(null);
  }

  async function saveEdit(itemId: string) {
    if (!editDraft) {
      return;
    }

    try {
      setSavingItemId(itemId);
      setError(null);

      await apiPatch(`/api/admin/quotes/${quoteId}/items/${itemId}`, {
        unitPrice: parseNonNegativeNumber(editDraft.unitPrice, "Unit price"),
        unitProjectedCost: parseNonNegativeNumber(editDraft.unitProjectedCost, "Unit cost"),
      });

      cancelEdit();
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error inesperado.");
    } finally {
      setSavingItemId(null);
    }
  }

  async function approveQuote() {
    try {
      setApproving(true);
      setError(null);
      const payload = await apiPost<{ jobId: string }>(`/api/admin/quotes/${quoteId}/approve`);
      setJobResult(payload);
      setRefreshKey((current) => current + 1);
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Error inesperado.");
    } finally {
      setApproving(false);
    }
  }

  async function rejectQuote() {
    const confirmed = window.confirm(
      "Rechazar esta quote? Se conservara para historial y el lead pasara a quote_rejected.",
    );

    if (!confirmed) {
      return;
    }

    const reasonInput = window.prompt("Motivo de rechazo (opcional):");
    const reason = reasonInput ? reasonInput.trim() : "";

    try {
      setRejecting(true);
      setError(null);
      await apiPost(`/api/admin/quotes/${quoteId}/reject`, {
        reason: reason || undefined,
      });
      setRefreshKey((current) => current + 1);
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Error inesperado.");
    } finally {
      setRejecting(false);
    }
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!quote) {
    return <p className="text-sm text-muted-foreground">Cargando quote...</p>;
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Quote</p>
        <h1 className="mt-1 text-2xl font-semibold">{quote.id.slice(0, 8)}</h1>
        <div className="mt-1">
          <Badge variant="outline">{quote.status}</Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Que hace &quot;Override marco&quot;</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            Cambia el marco curado del item y recalcula automaticamente el unit price y unit
            cost base con el nuevo marco.
          </p>
          <p className="text-xs text-muted-foreground">
            Si luego editas precio/costo manualmente, el origen pasa a &quot;manual_edit&quot;.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Totales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>Subtotal: ${quote.subtotal.toFixed(2)}</p>
          <p>Total: ${quote.total.toFixed(2)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Disponibilidad de stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {availability ? (
            <>
              <p className={availability.hasShortage ? "font-medium text-amber-700" : undefined}>
                {availability.hasShortage
                  ? "Hay faltantes. Se requiere compra para completar esta quote."
                  : "Stock suficiente para todos los materiales de la quote."}
              </p>
              {availability.items.map((stockItem) => (
                <p key={stockItem.catalogItemId} className="text-xs">
                  {stockItem.catalogItemName ?? stockItem.catalogItemId}: req{" "}
                  {stockItem.requiredQuantity.toFixed(4)} {stockItem.unit ?? ""} | disp{" "}
                  {stockItem.availableQuantity.toFixed(4)} {stockItem.unit ?? ""} | faltante{" "}
                  {stockItem.shortageQuantity.toFixed(4)} {stockItem.unit ?? ""}
                </p>
              ))}
            </>
          ) : (
            <p className="text-muted-foreground">Sin datos de disponibilidad.</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {quote.items.map((item) => {
          const overrideSelection = selectionByItem[item.id] ?? buildInitialOverrideSelection(item);
          const primaryFrameOptions =
            item.assemblyMode === "bastidor"
              ? quote.activeFrames.filter((frame) => frame.supportsBastidor)
              : quote.activeFrames;
          const secondaryFrameOptions = quote.activeFrames.filter(
            (frame) => frame.supportsBastidor,
          );

          return (
            <Card key={item.id} size="sm">
              <CardHeader>
                <CardTitle className="text-sm">Item {item.id.slice(0, 8)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  {item.widthCm ?? "-"} x {item.heightCm ?? "-"} cm | cantidad {item.quantity}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">{assemblyLabel(item.assemblyMode, item.bastidorVariant)}</Badge>
                  {item.assemblyMode === "bastidor" ? (
                    <>
                      <Badge variant="outline">Luz {item.bastidorLightCm?.toFixed(1) ?? "-"} cm</Badge>
                      <Badge variant="outline">Lomo {item.bastidorLomoMm?.toFixed(1) ?? "-"} mm</Badge>
                      <Badge variant="outline">Soporte {item.bastidorSupportMm?.toFixed(1) ?? "-"} mm</Badge>
                      {item.bastidorVariant === "double_profile" && item.selectedSecondaryFrame ? (
                        <Badge variant="outline">
                          2da varilla {item.selectedSecondaryFrame.label}
                        </Badge>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pedido cliente:
                  {" "}
                  {item.widthCm ?? "-"} x {item.heightCm ?? "-"} cm +
                  {" "}
                  {woodLabel(item.requestedWoodType)}
                  {" "}
                  {styleLabel(item.requestedStyleType)}
                  {" "}
                  {colorLabel(item.requestedColorGroup)}
                  {" "}
                  {item.requestedFaceMm ?? "-"}x{item.requestedDepthMm ?? "-"} mm
                  {item.requestedColorGroup === "color" && item.requestedFinishColorHex ? (
                    <>
                      {" "}
                      ({item.requestedFinishColorHex}
                      {item.requestedFinishColorName ? ` - ${item.requestedFinishColorName}` : ""})
                    </>
                  ) : null}
                </p>

                <p className="text-xs">
                  Marco cotizado:
                  {" "}
                  {item.selectedFrame
                    ? `${item.selectedFrame.label} (${item.selectedFrame.faceMm}x${item.selectedFrame.depthMm} mm)`
                    : "No disponible"}
                  {item.selectedSecondaryFrame
                    ? ` + ${item.selectedSecondaryFrame.label} (${item.selectedSecondaryFrame.faceMm}x${item.selectedSecondaryFrame.depthMm} mm)`
                    : ""}
                </p>
                {editingItemId === item.id && editDraft ? (
                  <div className="grid gap-2 md:max-w-[360px]">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editDraft.unitPrice}
                      onChange={(event) =>
                        setEditDraft((current) =>
                          current
                            ? { ...current, unitPrice: event.target.value }
                            : current,
                        )
                      }
                      placeholder="Unit price"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editDraft.unitProjectedCost}
                      onChange={(event) =>
                        setEditDraft((current) =>
                          current
                            ? { ...current, unitProjectedCost: event.target.value }
                            : current,
                        )
                      }
                      placeholder="Unit cost"
                    />
                  </div>
                ) : (
                  <>
                    <p>Unit price: ${item.unitPrice.toFixed(2)}</p>
                    <p>Unit cost: ${item.unitProjectedCost.toFixed(2)}</p>
                  </>
                )}

                <div className="rounded-md border border-[var(--line)] bg-[var(--card)] p-2 text-xs">
                  <p>
                    Origen precio/costo:
                    {" "}
                    {item.pricingSource === "manual_edit"
                      ? "manual_edit"
                      : item.pricingSource === "calculated"
                        ? "calculated"
                        : "unknown"}
                  </p>
                  <p className="text-muted-foreground">
                    Formula base: metros requeridos * referencia marco + vidrio + paspartu + mano
                    de obra.
                  </p>
                  <p className="text-muted-foreground">
                    {item.bastidorVariant === "double_profile" ? "Metros por varilla:" : "Metros:"}
                    {" "}
                    {item.requiredMouldingM?.toFixed(2) ?? "-"} m | Ref principal:
                    {" "}
                    {formatMoney(item.selectedFrame?.referencePricePerMeter ?? null)}/m (price) /
                    {" "}
                    {formatMoney(item.selectedFrame?.referenceCostPerMeter ?? null)}/m (cost)
                  </p>
                  {item.bastidorVariant === "double_profile" ? (
                    <p className="text-muted-foreground">
                      Ref secundaria:
                      {" "}
                      {formatMoney(item.selectedSecondaryFrame?.referencePricePerMeter ?? null)}/m (price) /
                      {" "}
                      {formatMoney(item.selectedSecondaryFrame?.referenceCostPerMeter ?? null)}/m (cost)
                    </p>
                  ) : null}
                  <p className="text-muted-foreground">
                    Vidrio:
                    {" "}
                    {item.hasGlass
                      ? `${item.glassTypeName ?? item.glassTypeId ?? "-"} (${formatMoney(item.glassCostPerSquareM, 4)}/m2)`
                      : "No"}
                    {" "}
                    | Paspartu:
                    {" "}
                    {item.hasMatboard
                      ? `${item.matboardTypeName ?? item.matboardTypeId ?? "-"} (${formatMoney(item.matboardCostPerSquareM, 4)}/m2)`
                      : "No"}
                  </p>
                  <p className="text-muted-foreground">
                    Mano de obra (temporal): {formatMoney(item.laborCostPerCm)} | Perimetro:{" "}
                    {item.perimeterCm?.toFixed(2) ?? "-"} cm
                  </p>
                  <p className="text-muted-foreground">
                    Auto unit price/cost:
                    {" "}
                    {formatMoney(item.unitAutoPrice)} / {formatMoney(item.unitAutoCost)}
                  </p>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <Select
                    value={overrideSelection.frameCatalogId}
                    onValueChange={(value) =>
                      setSelectionByItem((current) => ({
                        ...current,
                        [item.id]: {
                          ...overrideSelection,
                          frameCatalogId: value ?? item.frameCatalogId,
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="min-w-[320px]">
                      <SelectValue placeholder="Selecciona marco curado">
                        {frameLabelById[overrideSelection.frameCatalogId] ?? "Selecciona marco curado"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {item.selectedFrame &&
                      !primaryFrameOptions.some((frame) => frame.id === item.selectedFrame?.id) ? (
                        <SelectItem key={`${item.selectedFrame.id}-inactive`} value={item.selectedFrame.id}>
                          {`${item.selectedFrame.label} (inactivo)`}
                        </SelectItem>
                      ) : null}
                      {primaryFrameOptions.map((frame) => (
                        <SelectItem key={frame.id} value={frame.id}>
                          {frameLabelById[frame.id]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {item.bastidorVariant === "double_profile" ? (
                    <Select
                      value={overrideSelection.bastidorSecondaryFrameId ?? undefined}
                      onValueChange={(value) =>
                        setSelectionByItem((current) => ({
                          ...current,
                          [item.id]: {
                            ...overrideSelection,
                            bastidorSecondaryFrameId: value || null,
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="min-w-[320px]">
                        <SelectValue placeholder="2da varilla">
                          {(overrideSelection.bastidorSecondaryFrameId
                            ? frameLabelById[overrideSelection.bastidorSecondaryFrameId]
                            : null) ?? "2da varilla"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {item.selectedSecondaryFrame &&
                        !secondaryFrameOptions.some(
                          (frame) => frame.id === item.selectedSecondaryFrame?.id,
                        ) ? (
                          <SelectItem
                            key={`${item.selectedSecondaryFrame.id}-inactive`}
                            value={item.selectedSecondaryFrame.id}
                          >
                            {`${item.selectedSecondaryFrame.label} (inactiva)`}
                          </SelectItem>
                        ) : null}
                        {secondaryFrameOptions.map((frame) => (
                          <SelectItem key={frame.id} value={frame.id}>
                            {frameLabelById[frame.id]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>

                {item.bastidorVariant === "double_profile" ? (
                  <p className="text-xs text-muted-foreground">
                    La segunda varilla se registra para costo y detalle. La geometria del
                    bastidor se deriva de la varilla principal.
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => overrideFrame(item.id)}
                    disabled={isFinalized || approving || rejecting || editingItemId !== null}
                  >
                    Override marco
                  </Button>

                  {editingItemId === item.id ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveEdit(item.id)}
                        disabled={savingItemId === item.id || approving || rejecting}
                      >
                        Guardar precios
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={savingItemId === item.id || approving || rejecting}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(item)}
                      disabled={isFinalized || approving || rejecting || editingItemId !== null}
                    >
                      Editar precios
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={approveQuote}
          disabled={Boolean(isFinalized) || approving || rejecting || editingItemId !== null}
        >
          Aprobar quote y crear job
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={rejectQuote}
          disabled={
            quote.status === "quote_rejected" ||
            quote.status === "quote_approved" ||
            approving ||
            rejecting ||
            editingItemId !== null
          }
        >
          Rechazar quote
        </Button>
        {jobResult ? (
          <Link
            href={`/admin/jobs/${jobResult.jobId}`}
            className={buttonVariants({ variant: "link", size: "sm" })}
          >
            Abrir job {jobResult.jobId.slice(0, 8)}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
