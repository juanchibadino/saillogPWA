"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import {
  COLOR_GROUP_LABELS,
  STYLE_LABELS,
  WOOD_LABELS,
  type ColorGroup,
  type StyleType,
  type WoodType,
} from "@/lib/catalog/taxonomy";
import {
  calculateFrameGeometry,
  type FrameGeometryResult,
} from "@/lib/pricing/frame-geometry";
import {
  type AssemblyMode,
  type BastidorVariant,
} from "@/types/domain";
import { apiGet, apiPatch, apiPost } from "@/features/admin/api";
import { round2 } from "@/lib/utils/math";

type LeadDetail = {
  id: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  status: string;
  preliminaryTotal: number;
  notes: string | null;
  items: Array<{
    id: string;
    widthCm: number;
    heightCm: number;
    quantity: number;
    woodType: string;
    styleType: StyleType;
    colorGroup: ColorGroup;
    finishColorHex: string | null;
    finishColorName: string | null;
    faceMm: number;
    depthMm: number;
    hasGlass: boolean;
    hasMatboard: boolean;
    matboardBorderCm: number | null;
    frameCost: number | null;
    glassCost: number | null;
    matboardCost: number | null;
    laborCost: number | null;
    requiredMouldingCm: number;
    requiredMouldingM: number;
    preliminaryPrice: number;
    projectedCost: number;
    frameCatalogId: string;
    glassTypeId: string | null;
    matboardTypeId: string | null;
    frameLabel: string | null;
    glassTypeName: string | null;
    matboardTypeName: string | null;
    frameReferenceCostPerM: number | null;
    assemblyMode: AssemblyMode;
    bastidorVariant: BastidorVariant | null;
    bastidorLightCm: number | null;
    bastidorSecondaryFrameCatalogId: string | null;
    bastidorSecondaryFrameLabel: string | null;
    bastidorSecondaryFrameReferenceCostPerM: number | null;
    bastidorSupportMm: number | null;
    bastidorLomoMm: number | null;
    bastidorDepthMm: number | null;
    glassReferenceCostPerM2: number | null;
    matboardReferenceCostPerM2: number | null;
  }>;
};

function titleize(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function styleLabel(value: string) {
  return STYLE_LABELS[value as StyleType] ?? titleize(value);
}

function woodLabel(value: string) {
  return WOOD_LABELS[value as WoodType] ?? titleize(value);
}

function formatMoney(value: number | null, digits = 2) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return `$${value.toFixed(digits)}`;
}

function formatRate(value: number | null, unit: "m" | "m2") {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return `${formatMoney(value, 4)}/${unit}`;
}

function assemblyLabel(item: LeadDetail["items"][number]) {
  if (item.assemblyMode !== "bastidor") {
    return "Normal";
  }

  return item.bastidorVariant === "double_profile"
    ? "Bastidor dos varillas"
    : "Bastidor simple";
}

function buildBastidorSnapshot(item: LeadDetail["items"][number]) {
  if (
    item.assemblyMode !== "bastidor" ||
    !item.bastidorVariant ||
    item.bastidorLightCm === null ||
    item.bastidorSupportMm === null ||
    item.bastidorLomoMm === null ||
    item.bastidorDepthMm === null
  ) {
    return null;
  }

  return {
    variant: item.bastidorVariant,
    lightCm: item.bastidorLightCm,
    supportMm: item.bastidorSupportMm,
    lomoMm: item.bastidorLomoMm,
    depthMm: item.bastidorDepthMm,
    secondaryFrameId: item.bastidorSecondaryFrameCatalogId ?? null,
  };
}

function calculateItemGeometry(item: LeadDetail["items"][number]): FrameGeometryResult | null {
  if (item.hasMatboard && item.matboardBorderCm === null) {
    return null;
  }

  return calculateFrameGeometry({
    widthCm: item.widthCm,
    heightCm: item.heightCm,
    quantity: item.quantity,
    hasMatboard: item.hasMatboard,
    matboardBorderCm: item.hasMatboard ? item.matboardBorderCm ?? 0 : undefined,
    frameFaceMm: item.faceMm,
    assemblyMode: item.assemblyMode,
    bastidor: buildBastidorSnapshot(item),
  });
}

function calculateInvoiceMetrics(item: LeadDetail["items"][number]) {
  const geometry = calculateItemGeometry(item);

  if (!geometry) {
    return null;
  }

  return {
    outerWidthCm: round2(geometry.outerWidthCm),
    outerHeightCm: round2(geometry.outerHeightCm),
    areaM2: round2(geometry.areaM2),
    hasSupportMismatch: geometry.hasSupportMismatch,
  };
}

function calculateMouldingMetrics(item: LeadDetail["items"][number]) {
  const geometry = calculateItemGeometry(item);

  if (!geometry) {
    return null;
  }

  const faceCm = Math.max(item.faceMm, 0) / 10;
  const heightCm = Math.max(item.heightCm, 0) * 2;
  const widthCm = Math.max(item.widthCm, 0) * 2;
  const mitersCm = faceCm * 8;
  const lightCm = geometry.lightCm * 8;
  const lomoCm = (geometry.lomoMm / 10) * 8;
  const matboardCm = geometry.matboardBorderCm * 8;
  const subtotalCm =
    item.assemblyMode === "bastidor"
      ? heightCm + widthCm + lightCm + lomoCm + matboardCm
      : heightCm + widthCm + mitersCm + matboardCm;
  const quantity = Math.max(item.quantity, 1);
  const withWastePerUnitCm = subtotalCm * 1.1;
  const totalWithWasteCm = withWastePerUnitCm * quantity;
  const profileCount =
    item.assemblyMode === "bastidor" && item.bastidorVariant === "double_profile" ? 2 : 1;

  return {
    faceCm: round2(faceCm),
    lightCm: round2(geometry.lightCm),
    supportMm: round2(geometry.supportMm),
    lomoCm: round2(geometry.lomoMm / 10),
    depthMm: round2(geometry.depthMm),
    matboardBorderCm: round2(geometry.matboardBorderCm),
    heightCm: round2(heightCm),
    widthCm: round2(widthCm),
    mitersCm: round2(mitersCm),
    lightTotalCm: round2(lightCm),
    lomoTotalCm: round2(lomoCm),
    matboardCm: round2(matboardCm),
    subtotalCm: round2(subtotalCm),
    withWastePerUnitCm: round2(withWastePerUnitCm),
    totalWithWasteCm: round2(totalWithWasteCm),
    totalWithWasteM: round2(totalWithWasteCm / 100),
    profileCount,
    combinedWithWasteCm: round2(totalWithWasteCm * profileCount),
    combinedWithWasteM: round2((totalWithWasteCm * profileCount) / 100),
    hasSupportMismatch: geometry.hasSupportMismatch,
  };
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = params.id;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoteResult, setQuoteResult] = useState<{ quoteId: string } | null>(null);
  const [laborDraftByItem, setLaborDraftByItem] = useState<Record<string, string>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function run() {
      try {
        const payload = await apiGet<LeadDetail>(`/api/admin/leads/${leadId}`);

        if (ignore) {
          return;
        }

        setLead(payload);
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
  }, [leadId, refreshKey]);

  useEffect(() => {
    if (!lead) {
      return;
    }

    setLaborDraftByItem(
      Object.fromEntries(
        lead.items.map((item) => [item.id, (item.laborCost ?? 0).toFixed(2)]),
      ),
    );
  }, [lead]);

  async function createQuote() {
    try {
      const payload = await apiPost<{ quoteId: string }>(
        `/api/admin/leads/${leadId}/quote`,
      );
      setQuoteResult(payload);
      setRefreshKey((current) => current + 1);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Error inesperado.");
    }
  }

  async function saveLaborCost(itemId: string) {
    const draftValue = laborDraftByItem[itemId] ?? "";
    const parsed = Number(draftValue.trim());

    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("La mano de obra debe ser un numero mayor o igual a 0.");
      return;
    }

    try {
      setSavingItemId(itemId);
      setError(null);

      await apiPatch(`/api/admin/leads/${leadId}/items/${itemId}`, {
        laborCost: parsed,
      });

      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error inesperado.");
    } finally {
      setSavingItemId(null);
    }
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!lead) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <Skeleton className="h-8 w-full max-w-[20rem]" />
          <Skeleton className="h-4 w-full max-w-[24rem]" />
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full max-w-[16rem]" />
            <Skeleton className="h-4 w-full max-w-[14rem]" />
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Card className="gap-0 py-0">
            <CardContent className="p-0">
              <TableSkeleton columns={7} rows={8} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const preliminaryFromItems = lead.items.reduce(
    (total, item) => total + item.preliminaryPrice,
    0,
  );
  const projectedCostTotal = lead.items.reduce((total, item) => total + item.projectedCost, 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="mt-1 text-2xl font-semibold">{lead.customerName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lead.customerPhone} {lead.customerEmail ? `| ${lead.customerEmail}` : ""}
        </p>
      </header>

      <div className="space-y-2">

            {lead.items.length === 0 ? (
              <p className="mt-3 px-3 pb-3 text-sm text-muted-foreground">No hay items en este lead.</p>
            ) : null}
      </div>

      <div>
          {lead.items.length === 0 ? (
            <p className="text-muted-foreground">No hay items para desglosar costos.</p>
          ) : (
            <div className="space-y-3">
              {lead.items.map((item) => {
                const hasCostBreakdown =
                  item.frameCost !== null &&
                  item.glassCost !== null &&
                  item.matboardCost !== null &&
                  item.laborCost !== null;
                const invoiceMetrics = calculateInvoiceMetrics(item);
                const mouldingMetrics = calculateMouldingMetrics(item);
                const mouldingProfileCm = `${(Math.max(item.faceMm, 0) / 10).toFixed(1)} x ${(Math.max(item.depthMm, 0) / 10).toFixed(1)} cm`;
                const mouldingTypeLabel = `${item.frameLabel ?? item.frameCatalogId.slice(0, 8)} (${mouldingProfileCm})`;
                const subtotalComponents = hasCostBreakdown
                  ? (item.frameCost ?? 0) +
                    (item.glassCost ?? 0) +
                    (item.matboardCost ?? 0) +
                    (item.laborCost ?? 0)
                  : null;

                return (
                  <div key={`invoice-${item.id}`} className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Card className="gap-0 overflow-hidden py-0">
                        <CardHeader className="border-b bg-muted/20 py-4">
                          <CardTitle className="text-sm font-medium">Detalle item</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 px-4 py-4 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-muted-foreground">ID</p>
                            <Badge variant="outline" className="font-mono tabular-nums">
                              {item.id.slice(0, 8)}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <p className="text-muted-foreground">Varilla</p>
                            <Badge
                              variant="outline"
                              className="max-w-[18rem] truncate"
                              title={mouldingTypeLabel}
                            >
                              {mouldingTypeLabel}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <p className="text-muted-foreground">Armado</p>
                            <Badge variant="outline">{assemblyLabel(item)}</Badge>
                          </div>

                          {item.assemblyMode === "bastidor" ? (
                            <>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-muted-foreground">Luz</p>
                                <p className="text-right font-mono tabular-nums text-muted-foreground">
                                  {item.bastidorLightCm?.toFixed(1) ?? "-"} cm
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-muted-foreground">Lomo</p>
                                <p className="text-right font-mono tabular-nums text-muted-foreground">
                                  {item.bastidorLomoMm?.toFixed(1) ?? "-"} mm
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-muted-foreground">Soporte real</p>
                                <p className="text-right font-mono tabular-nums text-muted-foreground">
                                  {item.bastidorSupportMm?.toFixed(1) ?? "-"} mm
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-muted-foreground">Profundidad</p>
                                <p className="text-right font-mono tabular-nums text-muted-foreground">
                                  {item.bastidorDepthMm?.toFixed(1) ?? "-"} mm
                                </p>
                              </div>
                              {item.bastidorVariant === "double_profile" ? (
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-muted-foreground">2da varilla</p>
                                  <Badge
                                    variant="outline"
                                    className="max-w-[18rem] truncate"
                                    title={item.bastidorSecondaryFrameLabel ?? undefined}
                                  >
                                    {item.bastidorSecondaryFrameLabel ??
                                      item.bastidorSecondaryFrameCatalogId?.slice(0, 8) ??
                                      "-"}
                                  </Badge>
                                </div>
                              ) : null}
                            </>
                          ) : null}

                          <div className="flex items-center justify-between gap-3">
                            <p className="text-muted-foreground">Vidrio</p>
                            <Badge variant={item.hasGlass ? "outline" : "secondary"}>
                              {item.hasGlass
                                ? item.glassTypeName ?? item.glassTypeId ?? "Seleccionado"
                                : "Sin vidrio"}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <p className="text-muted-foreground">Paspartu</p>
                            {item.hasMatboard ? (
                              <p className="text-right font-mono tabular-nums text-muted-foreground">
                                {item.matboardBorderCm !== null
                                  ? `${item.matboardBorderCm.toFixed(1)} cm`
                                  : "No disponible"}
                              </p>
                            ) : (
                              <Badge variant="secondary">Sin paspartu</Badge>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <p className="text-muted-foreground">Total area (cm)</p>
                            <p className="text-right font-mono tabular-nums text-muted-foreground">
                              {invoiceMetrics
                                ? `${invoiceMetrics.outerWidthCm.toFixed(2)} x ${invoiceMetrics.outerHeightCm.toFixed(2)} cm | ${item.quantity} u`
                                : "No disponible"}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <p className="text-muted-foreground">Total area (m2)</p>
                            <p className="text-right font-mono tabular-nums text-muted-foreground">
                              {invoiceMetrics ? `${invoiceMetrics.areaM2.toFixed(2)} m2` : "No disponible"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="gap-0 overflow-hidden py-0">
                        <CardHeader className="border-b bg-muted/20 py-4">
                          <CardTitle className="text-sm font-medium">Total varillado</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 py-4">
                          <p className="text-muted-foreground">Tipo de varilla: {mouldingTypeLabel}</p>
                          {mouldingMetrics ? (
                            <div className="mt-2 space-y-1.5 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <p className="flex items-center gap-2 text-muted-foreground">
                                  <span className="size-2.5 rounded-full border" />
                                  Alto ({item.heightCm.toFixed(1)} x 2)
                                </p>
                                <p className="font-mono tabular-nums text-muted-foreground">
                                  {mouldingMetrics.heightCm.toFixed(1)} cm
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <p className="flex items-center gap-2 text-muted-foreground">
                                  <span className="size-2.5 rounded-full border" />
                                  Ancho ({item.widthCm.toFixed(1)} x 2)
                                </p>
                                <p className="font-mono tabular-nums text-muted-foreground">
                                  {mouldingMetrics.widthCm.toFixed(1)} cm
                                </p>
                              </div>
                              {item.assemblyMode === "bastidor" ? (
                                <>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="flex items-center gap-2 text-muted-foreground">
                                      <span className="size-2.5 rounded-full border" />
                                      Luz ({mouldingMetrics.lightCm.toFixed(1)} x 8)
                                    </p>
                                    <p className="font-mono tabular-nums text-muted-foreground">
                                      {mouldingMetrics.lightTotalCm.toFixed(1)} cm
                                    </p>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="flex items-center gap-2 text-muted-foreground">
                                      <span className="size-2.5 rounded-full border" />
                                      Lomo ({mouldingMetrics.lomoCm.toFixed(1)} x 8)
                                    </p>
                                    <p className="font-mono tabular-nums text-muted-foreground">
                                      {mouldingMetrics.lomoTotalCm.toFixed(1)} cm
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center justify-between gap-3">
                                  <p className="flex items-center gap-2 text-muted-foreground">
                                    <span className="size-2.5 rounded-full border" />
                                    Ingletes ({mouldingMetrics.faceCm.toFixed(1)} x 8)
                                  </p>
                                  <p className="font-mono tabular-nums text-muted-foreground">
                                    {mouldingMetrics.mitersCm.toFixed(1)} cm
                                  </p>
                                </div>
                              )}
                              {item.hasMatboard ? (
                                <div className="flex items-center justify-between gap-3">
                                  <p className="flex items-center gap-2 text-muted-foreground">
                                    <span className="size-2.5 rounded-full border" />
                                    Paspartu ({mouldingMetrics.matboardBorderCm.toFixed(1)} x 8)
                                  </p>
                                  <p className="font-mono tabular-nums text-muted-foreground">
                                    {mouldingMetrics.matboardCm.toFixed(1)} cm
                                  </p>
                                </div>
                              ) : null}
                              <div className="my-1 border-t" />
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-muted-foreground">Subtotal</p>
                                <p className="font-mono tabular-nums text-muted-foreground">
                                  {mouldingMetrics.subtotalCm.toFixed(1)} cm
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-muted-foreground">Merma (+10%)</p>
                                <p className="font-mono tabular-nums text-muted-foreground">
                                  {mouldingMetrics.withWastePerUnitCm.toFixed(1)} cm por varilla
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-3 border-t pt-1.5 font-medium">
                                <p>
                                  Total con merma ({item.quantity} u
                                  {mouldingMetrics.profileCount > 1
                                    ? ` x ${mouldingMetrics.profileCount} varillas`
                                    : ""}
                                  )
                                </p>
                                <p className="font-mono tabular-nums">
                                  {mouldingMetrics.profileCount > 1
                                    ? `${mouldingMetrics.combinedWithWasteCm.toFixed(1)} cm (${mouldingMetrics.combinedWithWasteM.toFixed(2)} m)`
                                    : `${mouldingMetrics.totalWithWasteCm.toFixed(1)} cm (${mouldingMetrics.totalWithWasteM.toFixed(2)} m)`}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                              <p>Total varillado no disponible para desglosar.</p>
                              <p>Falta borde de paspartu guardado en este registro.</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="gap-0 overflow-hidden py-0">
                      <CardHeader className="border-b bg-muted/20 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <CardTitle className="text-sm font-medium">Desglose de costos</CardTitle>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="w-[160px]"
                              value={laborDraftByItem[item.id] ?? ""}
                              onChange={(event) =>
                                setLaborDraftByItem((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                              placeholder="Mano de obra"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => saveLaborCost(item.id)}
                              disabled={savingItemId === item.id}
                            >
                              {savingItemId === item.id ? "Guardando..." : "Guardar mano de obra"}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {hasCostBreakdown ? (
                        <>
                          <CardContent className="p-0">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader className="bg-muted">
                                  <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
                                    <TableHead className="h-8 px-3">Concepto</TableHead>
                                    <TableHead className="h-8 px-3">Cantidad</TableHead>
                                    <TableHead className="h-8 px-3">Tarifa</TableHead>
                                    <TableHead className="h-8 px-3 text-right">Importe</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {item.assemblyMode === "bastidor" &&
                                  item.bastidorVariant === "double_profile" ? (
                                    <>
                                      <TableRow>
                                        <TableCell className="px-3 py-2.5">
                                          Varilla soporte ({item.frameLabel ?? item.frameCatalogId.slice(0, 8)})
                                        </TableCell>
                                        <TableCell className="px-3 py-2.5">{item.requiredMouldingM.toFixed(2)} m</TableCell>
                                        <TableCell className="px-3 py-2.5">
                                          {formatRate(item.frameReferenceCostPerM, "m")}
                                        </TableCell>
                                        <TableCell className="px-3 py-2.5 text-right text-muted-foreground">
                                          Incluida en total marco
                                        </TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell className="px-3 py-2.5">
                                          Varilla profundidad ({item.bastidorSecondaryFrameLabel ?? item.bastidorSecondaryFrameCatalogId?.slice(0, 8) ?? "-"})
                                        </TableCell>
                                        <TableCell className="px-3 py-2.5">{item.requiredMouldingM.toFixed(2)} m</TableCell>
                                        <TableCell className="px-3 py-2.5">
                                          {formatRate(item.bastidorSecondaryFrameReferenceCostPerM, "m")}
                                        </TableCell>
                                        <TableCell className="px-3 py-2.5 text-right text-muted-foreground">
                                          Incluida en total marco
                                        </TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell className="px-3 py-2.5 font-medium">
                                          Total varillado bastidor
                                        </TableCell>
                                        <TableCell className="px-3 py-2.5">
                                          {(item.requiredMouldingM * 2).toFixed(2)} m
                                        </TableCell>
                                        <TableCell className="px-3 py-2.5">Combinado</TableCell>
                                        <TableCell className="px-3 py-2.5 text-right">{formatMoney(item.frameCost)}</TableCell>
                                      </TableRow>
                                    </>
                                  ) : (
                                    <TableRow>
                                      <TableCell className="px-3 py-2.5">
                                        Total varillado ({item.frameLabel ?? item.frameCatalogId.slice(0, 8)})
                                      </TableCell>
                                      <TableCell className="px-3 py-2.5">{item.requiredMouldingM.toFixed(2)} m</TableCell>
                                      <TableCell className="px-3 py-2.5">
                                        {formatRate(item.frameReferenceCostPerM, "m")}
                                      </TableCell>
                                      <TableCell className="px-3 py-2.5 text-right">{formatMoney(item.frameCost)}</TableCell>
                                    </TableRow>
                                  )}

                                  {item.hasGlass ? (
                                    <TableRow>
                                      <TableCell className="px-3 py-2.5">
                                        Vidrio ({item.glassTypeName ?? item.glassTypeId ?? "Seleccionado"})
                                      </TableCell>
                                      <TableCell className="px-3 py-2.5">
                                        {invoiceMetrics ? `${invoiceMetrics.areaM2.toFixed(2)} m2` : "-"}
                                      </TableCell>
                                      <TableCell className="px-3 py-2.5">
                                        {formatRate(item.glassReferenceCostPerM2, "m2")}
                                      </TableCell>
                                      <TableCell className="px-3 py-2.5 text-right">{formatMoney(item.glassCost)}</TableCell>
                                    </TableRow>
                                  ) : null}

                                  {item.hasMatboard ? (
                                    <TableRow>
                                      <TableCell className="px-3 py-2.5">
                                        Paspartu ({item.matboardTypeName ?? item.matboardTypeId ?? "Seleccionado"})
                                      </TableCell>
                                      <TableCell className="px-3 py-2.5">
                                        {invoiceMetrics ? `${invoiceMetrics.areaM2.toFixed(2)} m2` : "-"}
                                      </TableCell>
                                      <TableCell className="px-3 py-2.5">
                                        {formatRate(item.matboardReferenceCostPerM2, "m2")}
                                      </TableCell>
                                      <TableCell className="px-3 py-2.5 text-right">{formatMoney(item.matboardCost)}</TableCell>
                                    </TableRow>
                                  ) : null}

                                  <TableRow>
                                    <TableCell className="px-3 py-2.5">Mano de obra</TableCell>
                                    <TableCell className="px-3 py-2.5">-</TableCell>
                                    <TableCell className="px-3 py-2.5">-</TableCell>
                                    <TableCell className="px-3 py-2.5 text-right">{formatMoney(item.laborCost)}</TableCell>
                                  </TableRow>

                                  {item.colorGroup === "color" ? (
                                    <TableRow>
                                      <TableCell className="px-3 py-2.5">Pintura de varilla</TableCell>
                                      <TableCell className="px-3 py-2.5">-</TableCell>
                                      <TableCell className="px-3 py-2.5">Incluida</TableCell>
                                      <TableCell className="px-3 py-2.5 text-right text-muted-foreground">
                                        Incluida en marco
                                      </TableCell>
                                    </TableRow>
                                  ) : null}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>

                          <div className="space-y-1 border-t px-4 py-3">
                            <div className="flex items-center justify-between">
                              <p className="text-muted-foreground">Subtotal componentes</p>
                              <p>{formatMoney(subtotalComponents)}</p>
                            </div>
                            <div className="flex items-center justify-between font-medium">
                              <p>Total item</p>
                              <p>{formatMoney(item.projectedCost)}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <CardContent className="px-4 py-3">
                          <p className="text-muted-foreground">
                            Desglose no disponible para este item. Faltan snapshots de costos o borde de paspartu guardado.
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={createQuote}>
          Crear quote desde lead
        </Button>
        {quoteResult ? (
          <Link
            href={`/admin/quotes/${quoteResult.quoteId}`}
            className={buttonVariants({ variant: "link", size: "sm" })}
          >
            Abrir quote {quoteResult.quoteId.slice(0, 8)}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
