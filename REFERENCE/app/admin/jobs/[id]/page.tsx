"use client";

import { useParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { apiGet, apiPatch, apiPost } from "@/features/admin/api";
import {
  PurchaseForm,
  type PurchaseFormSeedLine,
} from "@/features/admin/purchases/purchase-form";
import { PurchasesTable } from "@/features/admin/purchases/purchases-table";
import type {
  PurchaseCatalogItem,
  PurchaseRecord,
  PurchaseStockPayload,
  SupplierOption,
} from "@/features/admin/purchases/types";
import {
  JOB_STAGE_STATUSES,
  type JobStageStatus,
} from "@/lib/jobs/stages";

type JobMaterial = {
  key: string;
  jobItemId: string;
  catalogItemId: string;
  kind: "frame" | "glass" | "matboard";
  label: string;
  unit: "m" | "m2";
  requiredQuantity: number;
  onHandQuantity: number;
  pieceCount: number;
  metersPerPiece: number | null;
  widthCm: number | null;
  heightCm: number | null;
  consumed: boolean;
};

type JobDetail = {
  id: string;
  quoteId: string;
  status: string;
  dueDate: string | null;
  projectedRevenue: number;
  projectedTotalCost: number;
  projectedMargin: number;
  actualTotalCost: number | null;
  actualMargin: number | null;
  createdAt: string;
  items: Array<{
    id: string;
    widthCm: number;
    heightCm: number;
    frameCatalogId: string;
    quantity: number;
    requiredMouldingM: number;
    projectedCost: number;
    actualCost: number | null;
    materials: JobMaterial[];
  }>;
  stages: Array<{
    id: string;
    name: string;
    status: JobStageStatus;
    estimatedMinutes: number | null;
    actualMinutes: number | null;
  }>;
  purchases: PurchaseRecord[];
};

type StageDraft = {
  status: JobStageStatus;
  estimatedMinutes: string;
  actualMinutes: string;
};

function formatMoney(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `$${value.toFixed(2)}`;
}

function formatQty(value: number, unit: string) {
  return `${value.toFixed(4)} ${unit}`;
}

function stageStatusLabel(status: JobStageStatus) {
  if (status === "in_progress") {
    return "In progress";
  }

  if (status === "done") {
    return "Done";
  }

  return "Pending";
}

function stageStatusVariant(status: JobStageStatus) {
  if (status === "done") {
    return "default" as const;
  }

  if (status === "in_progress") {
    return "outline" as const;
  }

  return "secondary" as const;
}

function formatMaterialKind(kind: JobMaterial["kind"]) {
  if (kind === "glass") {
    return "Glass";
  }

  if (kind === "matboard") {
    return "Matboard";
  }

  return "Frame";
}

function humanizeToken(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}

function parseMinutes(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value.trim());

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Minutes must be an integer greater than or equal to 0.");
  }

  return parsed;
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [catalogItems, setCatalogItems] = useState<PurchaseCatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stageDrafts, setStageDrafts] = useState<Record<string, StageDraft>>({});
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseDialogKey, setPurchaseDialogKey] = useState(0);
  const [purchaseInitialLines, setPurchaseInitialLines] = useState<PurchaseFormSeedLine[]>([]);
  const [consumingMaterialKey, setConsumingMaterialKey] = useState<string | null>(null);
  const [savingStageId, setSavingStageId] = useState<string | null>(null);
  const [receivingPurchaseId, setReceivingPurchaseId] = useState<string | null>(null);
  const [closingJob, setClosingJob] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [jobPayload, suppliersPayload, stockPayload] = await Promise.all([
          apiGet<JobDetail>(`/api/admin/jobs/${jobId}`),
          apiGet<SupplierOption[]>("/api/admin/suppliers"),
          apiGet<PurchaseStockPayload>("/api/admin/stock"),
        ]);

        if (ignore) {
          return;
        }

        setJob(jobPayload);
        setSuppliers(suppliersPayload);
        setCatalogItems((stockPayload.items ?? []).filter((item) => item.active));
        setStageDrafts(
          Object.fromEntries(
            jobPayload.stages.map((stage) => [
              stage.id,
              {
                status: stage.status,
                estimatedMinutes:
                  stage.estimatedMinutes === null ? "" : String(stage.estimatedMinutes),
                actualMinutes:
                  stage.actualMinutes === null ? "" : String(stage.actualMinutes),
              },
            ]),
          ),
        );
        setError(null);
      } catch (loadError) {
        if (ignore) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unexpected error.");
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, [jobId, refreshKey]);

  function openPurchaseDialog(initialLines: PurchaseFormSeedLine[] = []) {
    setPurchaseInitialLines(initialLines);
    setPurchaseDialogKey((current) => current + 1);
    setPurchaseDialogOpen(true);
  }

  function buildSeedLine(material: JobMaterial): PurchaseFormSeedLine {
    const catalogItem = catalogItems.find((item) => item.id === material.catalogItemId);

    return {
      catalogItemId: material.catalogItemId,
      pieceCount: material.pieceCount,
      unitCostNet: catalogItem?.suggestedCostPerUnit ?? 0,
      metersPerPiece: material.metersPerPiece,
      widthCm: material.widthCm,
      heightCm: material.heightCm,
    };
  }

  async function useMaterial(material: JobMaterial) {
    try {
      setConsumingMaterialKey(material.key);
      setError(null);
      await apiPost(`/api/admin/jobs/${jobId}/materials/consume`, {
        jobItemId: material.jobItemId,
        catalogItemId: material.catalogItemId,
      });
      setRefreshKey((current) => current + 1);
    } catch (consumeError) {
      setError(consumeError instanceof Error ? consumeError.message : "Unexpected error.");
    } finally {
      setConsumingMaterialKey(null);
    }
  }

  async function saveStage(stageId: string) {
    const draft = stageDrafts[stageId];

    if (!draft) {
      return;
    }

    try {
      setSavingStageId(stageId);
      setError(null);
      await apiPatch(`/api/admin/jobs/${jobId}/stages/${stageId}`, {
        status: draft.status,
        estimatedMinutes: parseMinutes(draft.estimatedMinutes),
        actualMinutes: parseMinutes(draft.actualMinutes),
      });
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unexpected error.");
    } finally {
      setSavingStageId(null);
    }
  }

  async function markPurchaseAsReceived(purchaseId: string) {
    try {
      setReceivingPurchaseId(purchaseId);
      setError(null);
      await apiPatch(`/api/admin/purchases/${purchaseId}`, {
        status: "received",
      });
      setRefreshKey((current) => current + 1);
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Unexpected error.");
    } finally {
      setReceivingPurchaseId(null);
    }
  }

  async function closeJob() {
    try {
      setClosingJob(true);
      setError(null);
      await apiPost(`/api/admin/jobs/${jobId}/close`);
      setRefreshKey((current) => current + 1);
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Unexpected error.");
    } finally {
      setClosingJob(false);
    }
  }

  if (!job) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Job</p>
          <Skeleton className="h-8 w-full max-w-[14rem]" />
          <Skeleton className="h-4 w-full max-w-[12rem]" />
        </header>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <section className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <TableSkeleton columns={7} />
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <TableSkeleton columns={5} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasUnusedMaterials = job.items.some((item) =>
    item.materials.some((material) => !material.consumed),
  );
  const hasIncompleteStages = job.stages.some((stage) => stage.status !== "done");
  const closeBlockedReasons = [
    hasIncompleteStages ? "Mark every stage as done before closing the job." : null,
    hasUnusedMaterials ? "Use every required material row before closing the job." : null,
  ].filter((reason): reason is string => Boolean(reason));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Job</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">#{job.id.slice(0, 8)}</h1>
            <Badge variant="outline">{humanizeToken(job.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Quote #{job.quoteId.slice(0, 8)}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => openPurchaseDialog()}
          disabled={suppliers.length === 0 || catalogItems.length === 0}
        >
          Register purchase
        </Button>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Project Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMoney(job.projectedRevenue)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Project Costs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{formatMoney(job.projectedTotalCost)}</p>
            {job.actualTotalCost !== null ? (
              <p className="text-xs text-muted-foreground">
                Actual: {formatMoney(job.actualTotalCost)}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Project Margin</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMoney(job.projectedMargin)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Project Real Margin</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMoney(job.actualMargin)}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <div className="px-1">
          <h2 className="text-sm font-medium">Job Items</h2>
        </div>
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
                  <TableHead className="h-10 px-3">Item</TableHead>
                  <TableHead className="h-10 px-3">Dimensions</TableHead>
                  <TableHead className="h-10 px-3">Qty</TableHead>
                  <TableHead className="h-10 px-3">Details</TableHead>
                  <TableHead className="h-10 px-3">Required</TableHead>
                  <TableHead className="h-10 px-3">Stock</TableHead>
                  <TableHead className="h-10 px-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.items.map((item) => (
                  <Fragment key={item.id}>
                    <TableRow key={item.id} className="bg-muted/20 hover:bg-muted/20">
                      <TableCell className="px-3 py-3 font-medium">#{item.id.slice(0, 8)}</TableCell>
                      <TableCell className="px-3 py-3">
                        {item.widthCm} x {item.heightCm} cm
                      </TableCell>
                      <TableCell className="px-3 py-3">{item.quantity}</TableCell>
                      <TableCell className="px-3 py-3">
                        <div className="space-y-1">
                          <p className="text-sm">
                            Projected {formatMoney(item.projectedCost)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Actual {formatMoney(item.actualCost)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        {item.requiredMouldingM.toFixed(2)} m moulding
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <Badge variant="outline">
                          {item.materials.every((material) => material.consumed)
                            ? "All used"
                            : "Pending use"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right text-sm text-muted-foreground">
                        {item.materials.length} material
                        {item.materials.length === 1 ? "" : "s"}
                      </TableCell>
                    </TableRow>
                    {item.materials.map((material) => {
                      const insufficientStock =
                        !material.consumed &&
                        material.onHandQuantity + 0.0001 < material.requiredQuantity;

                      return (
                        <TableRow key={material.key}>
                          <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                            {formatMaterialKind(material.kind)}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                            {material.unit === "m"
                              ? `${material.pieceCount} pieces`
                              : material.widthCm !== null && material.heightCm !== null
                                ? `${material.widthCm.toFixed(2)} x ${material.heightCm.toFixed(2)} cm`
                                : "-"}
                          </TableCell>
                          <TableCell className="px-3 py-2.5">{material.pieceCount}</TableCell>
                          <TableCell className="px-3 py-2.5">
                            <div className="space-y-1">
                              <p className="font-medium">{material.label}</p>
                              {material.metersPerPiece !== null ? (
                                <p className="text-xs text-muted-foreground">
                                  {material.metersPerPiece.toFixed(4)} m per piece
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2.5">
                            {formatQty(material.requiredQuantity, material.unit)}
                          </TableCell>
                          <TableCell className="px-3 py-2.5">
                            <div className="flex flex-col items-start gap-1">
                              <Badge variant={material.consumed ? "default" : "secondary"}>
                                {material.consumed ? "Used" : "Pending"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                On hand {formatQty(material.onHandQuantity, material.unit)}
                              </span>
                              {insufficientStock ? (
                                <span className="text-xs text-red-600">Not enough stock</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openPurchaseDialog([buildSeedLine(material)])}
                              >
                                Buy
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void useMaterial(material)}
                                disabled={
                                  material.consumed ||
                                  insufficientStock ||
                                  consumingMaterialKey === material.key
                                }
                              >
                                {consumingMaterialKey === material.key ? "Using..." : "Use"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <div className="px-1">
          <h2 className="text-sm font-medium">Stages</h2>
        </div>
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
                  <TableHead className="h-10 px-3">Stage</TableHead>
                  <TableHead className="h-10 px-3">Status</TableHead>
                  <TableHead className="h-10 px-3">Est. Minutes</TableHead>
                  <TableHead className="h-10 px-3">Real Minutes</TableHead>
                  <TableHead className="h-10 px-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.stages.map((stage) => {
                  const draft = stageDrafts[stage.id];

                  return (
                    <TableRow key={stage.id}>
                      <TableCell className="px-3 py-2.5">
                        <div className="space-y-1">
                          <p className="font-medium">{humanizeToken(stage.name)}</p>
                          <Badge variant={stageStatusVariant(stage.status)}>
                            {stageStatusLabel(stage.status)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Select
                          value={draft?.status ?? stage.status}
                          onValueChange={(value) =>
                            setStageDrafts((current) => ({
                              ...current,
                              [stage.id]: {
                                ...(current[stage.id] ?? {
                                  status: stage.status,
                                  estimatedMinutes:
                                    stage.estimatedMinutes === null
                                      ? ""
                                      : String(stage.estimatedMinutes),
                                  actualMinutes:
                                    stage.actualMinutes === null
                                      ? ""
                                      : String(stage.actualMinutes),
                                }),
                                status: value as JobStageStatus,
                              },
                            }))
                          }
                        >
                          <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {JOB_STAGE_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {stageStatusLabel(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Input
                          value={draft?.estimatedMinutes ?? ""}
                          onChange={(event) =>
                            setStageDrafts((current) => ({
                              ...current,
                              [stage.id]: {
                                ...(current[stage.id] ?? {
                                  status: stage.status,
                                  estimatedMinutes:
                                    stage.estimatedMinutes === null
                                      ? ""
                                      : String(stage.estimatedMinutes),
                                  actualMinutes:
                                    stage.actualMinutes === null
                                      ? ""
                                      : String(stage.actualMinutes),
                                }),
                                estimatedMinutes: event.target.value,
                              },
                            }))
                          }
                          inputMode="numeric"
                          placeholder="Minutes"
                          className="w-[140px]"
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Input
                          value={draft?.actualMinutes ?? ""}
                          onChange={(event) =>
                            setStageDrafts((current) => ({
                              ...current,
                              [stage.id]: {
                                ...(current[stage.id] ?? {
                                  status: stage.status,
                                  estimatedMinutes:
                                    stage.estimatedMinutes === null
                                      ? ""
                                      : String(stage.estimatedMinutes),
                                  actualMinutes:
                                    stage.actualMinutes === null
                                      ? ""
                                      : String(stage.actualMinutes),
                                }),
                                actualMinutes: event.target.value,
                              },
                            }))
                          }
                          inputMode="numeric"
                          placeholder="Minutes"
                          className="w-[140px]"
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void saveStage(stage.id)}
                          disabled={savingStageId === stage.id}
                        >
                          {savingStageId === stage.id ? "Saving..." : "Save"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <div className="px-1">
          <h2 className="text-sm font-medium">Close Job</h2>
        </div>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Close the job once every stage is done and every required material row is used.
              </p>
              {closeBlockedReasons.map((reason) => (
                <p key={reason} className="text-sm text-muted-foreground">
                  {reason}
                </p>
              ))}
            </div>
            <Button
              type="button"
              onClick={() => void closeJob()}
              disabled={closingJob || closeBlockedReasons.length > 0}
            >
              {closingJob ? "Closing..." : "Close job"}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <div className="px-1">
          <h2 className="text-sm font-medium">Associated Purchases</h2>
        </div>
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <PurchasesTable
              purchases={job.purchases}
              emptyMessage="No associated purchases yet."
              onMarkReceived={(purchaseId) => markPurchaseAsReceived(purchaseId)}
              receivingPurchaseId={receivingPurchaseId}
            />
          </CardContent>
        </Card>
      </section>

      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Register purchase</DialogTitle>
            <DialogDescription>
              Add one or more purchase lines for this job.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <PurchaseForm
              key={purchaseDialogKey}
              suppliers={suppliers}
              catalogItems={catalogItems}
              fixedJobId={jobId}
              initialLines={purchaseInitialLines}
              onSubmitted={async () => {
                setPurchaseDialogOpen(false);
                setRefreshKey((current) => current + 1);
              }}
              submitLabel="Save purchase"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
