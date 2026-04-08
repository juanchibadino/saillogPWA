"use client";

import { useEffect, useState } from "react";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  COLOR_GROUPS,
  STYLE_CODES,
  STYLE_LABELS,
  WOOD_LABELS,
  WOOD_TYPES,
  type ColorGroup,
  type StyleType,
  type WoodType,
} from "@/lib/catalog/taxonomy";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/features/admin/api";

type Supplier = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

type CatalogFrame = {
  id: string;
  woodType: string;
  styleType: StyleType;
  colorGroup: ColorGroup;
  faceMm: number;
  depthMm: number;
  supportsBastidor: boolean;
  lomoMm: number | null;
  referencePricePerMeter: number;
  referenceCostPerMeter: number;
  suggestedCostPerMeter: number;
  costDeviationPct: number;
  costDeviationAlert: boolean;
  purchaseCountWindow: number;
  supplierId: string | null;
  supplierCode: string | null;
  supplierName: string | null;
  supplierModelCode: string | null;
  isPublic: boolean;
  publicLabel: string | null;
  sortOrder: number;
  active: boolean;
};

type CreateDraft = {
  woodType: WoodType;
  styleType: StyleType;
  colorGroup: ColorGroup;
  faceMm: string;
  depthMm: string;
  supportsBastidor: boolean;
  lomoMm: string;
  referenceCostPerMeter: string;
  supplierId: string;
  supplierModelCode: string;
  publicLabel: string;
  sortOrder: string;
  active: boolean;
  isPublic: boolean;
};

type EditDraft = {
  woodType: WoodType;
  colorGroup: ColorGroup;
  faceMm: string;
  depthMm: string;
  supportsBastidor: boolean;
  lomoMm: string;
  publicLabel: string;
  sortOrder: string;
  referenceCostPerMeter: string;
  supplierId: string;
  supplierModelCode: string;
  active: boolean;
  isPublic: boolean;
};

const NO_SUPPLIER_VALUE = "__none_supplier__";

function displayWood(value: string) {
  return WOOD_LABELS[value as WoodType] ?? value;
}

function displayStyle(value: string) {
  return STYLE_LABELS[value as StyleType] ?? value;
}

function displayColor(value: string) {
  return COLOR_GROUP_LABELS[value as ColorGroup] ?? value;
}

function buildFrameLabel(frame: CatalogFrame) {
  return (
    frame.publicLabel ??
    `${displayWood(frame.woodType)} ${displayStyle(frame.styleType)} ${frame.faceMm}x${frame.depthMm} ${displayColor(frame.colorGroup)}`
  );
}

function parsePositiveNumber(rawValue: string, fieldName: string) {
  const value = Number(rawValue.trim());

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} debe ser un numero mayor a 0.`);
  }

  return value;
}

function parseNonNegativeNumber(rawValue: string, fieldName: string) {
  const value = Number(rawValue.trim());

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} debe ser un numero mayor o igual a 0.`);
  }

  return value;
}

function parseNonNegativeInt(rawValue: string, fieldName: string) {
  const value = Number(rawValue.trim());

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} debe ser un entero mayor o igual a 0.`);
  }

  return value;
}

function buildInitialCreateDraft(suppliers: Supplier[]): CreateDraft {
  return {
    woodType: "kiri",
    styleType: "chata",
    colorGroup: "natural",
    faceMm: "20",
    depthMm: "15",
    supportsBastidor: false,
    lomoMm: "",
    referenceCostPerMeter: "0",
    supplierId: suppliers[0]?.id ?? "",
    supplierModelCode: "",
    publicLabel: "",
    sortOrder: "0",
    active: true,
    isPublic: true,
  };
}

function buildEditDraft(frame: CatalogFrame, fallbackSupplierId: string): EditDraft {
  return {
    woodType: frame.woodType as WoodType,
    colorGroup: frame.colorGroup as ColorGroup,
    faceMm: String(frame.faceMm),
    depthMm: String(frame.depthMm),
    supportsBastidor: frame.supportsBastidor,
    lomoMm: frame.lomoMm === null ? "" : String(frame.lomoMm),
    publicLabel: frame.publicLabel ?? "",
    sortOrder: String(frame.sortOrder),
    referenceCostPerMeter: String(frame.referenceCostPerMeter),
    supplierId: frame.supplierId ?? fallbackSupplierId,
    supplierModelCode: frame.supplierModelCode ?? "",
    active: frame.active,
    isPublic: frame.isPublic,
  };
}

function isSameEditDraft(left: EditDraft | null, right: EditDraft | null) {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.woodType === right.woodType &&
    left.colorGroup === right.colorGroup &&
    left.faceMm === right.faceMm &&
    left.depthMm === right.depthMm &&
    left.supportsBastidor === right.supportsBastidor &&
    left.lomoMm === right.lomoMm &&
    left.publicLabel === right.publicLabel &&
    left.sortOrder === right.sortOrder &&
    left.referenceCostPerMeter === right.referenceCostPerMeter &&
    left.supplierId === right.supplierId &&
    left.supplierModelCode === right.supplierModelCode &&
    left.active === right.active &&
    left.isPublic === right.isPublic
  );
}

export default function CatalogAdminPage() {
  const [frames, setFrames] = useState<CatalogFrame[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editInitialDraft, setEditInitialDraft] = useState<EditDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editingFrame =
    editingId === null ? null : frames.find((frame) => frame.id === editingId) ?? null;
  const hasUnsavedEditChanges =
    editingId !== null && !isSameEditDraft(editDraft, editInitialDraft);
  const isSavingEdit = editingId !== null && savingId === editingId;
  const editSupplierExists = editDraft
    ? suppliers.some((supplier) => supplier.id === editDraft.supplierId)
    : false;
  const editSupplierLabel = editDraft
    ? (suppliers.find((supplier) => supplier.id === editDraft.supplierId)?.name?.trim() ||
      editingFrame?.supplierName?.trim() ||
      "Proveedor actual")
    : "Proveedor actual";
  const shouldRenderEditSupplierFallback = Boolean(editDraft?.supplierId) && !editSupplierExists;
  const editSupplierFallbackLabel = editSupplierLabel;

  async function loadData() {
    try {
      setLoading(true);
      const [framesPayload, suppliersPayload] = await Promise.all([
        apiGet<CatalogFrame[]>("/api/admin/catalog/profiles"),
        apiGet<Supplier[]>("/api/admin/suppliers"),
      ]);
      setFrames(framesPayload);
      setSuppliers(suppliersPayload);
      setError(null);
      setCreateDraft((current) => current ?? buildInitialCreateDraft(suppliersPayload));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function openCreateSheet() {
    if (editingId !== null) {
      return;
    }

    setCreateDraft(buildInitialCreateDraft(suppliers));
    setCreateOpen(true);
    setError(null);
  }

  function closeCreateSheet() {
    setCreateOpen(false);
  }

  async function createFrame() {
    if (!createDraft) {
      return;
    }

    if (!createDraft.supplierId) {
      setError("Selecciona un proveedor para crear el item de catalogo.");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      await apiPost<{ success: boolean; id: string }>("/api/admin/catalog/profiles", {
        woodType: createDraft.woodType,
        styleType: createDraft.styleType,
        colorGroup: createDraft.colorGroup,
        faceMm: parsePositiveNumber(createDraft.faceMm, "Frente"),
        depthMm: parsePositiveNumber(createDraft.depthMm, "Profundidad"),
        supportsBastidor: createDraft.supportsBastidor,
        lomoMm: createDraft.supportsBastidor
          ? parsePositiveNumber(createDraft.lomoMm, "Lomo")
          : null,
        referenceCostPerMeter: parseNonNegativeNumber(createDraft.referenceCostPerMeter, "Costo"),
        supplierId: createDraft.supplierId,
        supplierModelCode: createDraft.supplierModelCode.trim() || null,
        publicLabel: createDraft.publicLabel.trim() || null,
        sortOrder: parseNonNegativeInt(createDraft.sortOrder, "Orden"),
        active: createDraft.active,
        isPublic: createDraft.isPublic,
      });

      closeCreateSheet();
      await loadData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Error inesperado.");
    } finally {
      setCreating(false);
    }
  }

  async function togglePublic(frame: CatalogFrame) {
    try {
      await apiPost(`/api/admin/catalog/profiles/${frame.id}/publish`, {
        isPublic: !frame.isPublic,
        publicLabel: buildFrameLabel(frame),
        sortOrder: frame.sortOrder,
      });

      await loadData();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Error inesperado.");
    }
  }

  function startEdit(frame: CatalogFrame) {
    const nextDraft = buildEditDraft(frame, suppliers[0]?.id ?? "");

    setCreateOpen(false);
    setEditingId(frame.id);
    setEditDraft(nextDraft);
    setEditInitialDraft(nextDraft);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
    setEditInitialDraft(null);
  }

  function requestCloseEdit() {
    if (editingId === null) {
      return;
    }

    if (hasUnsavedEditChanges) {
      const confirmed = window.confirm("Hay cambios sin guardar. ¿Descartarlos?");

      if (!confirmed) {
        return;
      }
    }

    cancelEdit();
  }

  function handleEditSheetOpenChange(open: boolean) {
    if (open) {
      return;
    }

    requestCloseEdit();
  }

  function updateDraft<K extends keyof EditDraft>(field: K, value: EditDraft[K]) {
    setEditDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });
  }

  async function saveEdit(frameId: string) {
    if (!editDraft) {
      return;
    }

    if (!editDraft.supplierId) {
      setError("Selecciona un proveedor para guardar.");
      return;
    }

    try {
      setSavingId(frameId);
      setError(null);

      const payload = {
        woodType: editDraft.woodType,
        colorGroup: editDraft.colorGroup,
        faceMm: parsePositiveNumber(editDraft.faceMm, "Frente"),
        depthMm: parsePositiveNumber(editDraft.depthMm, "Profundidad"),
        supportsBastidor: editDraft.supportsBastidor,
        lomoMm: editDraft.supportsBastidor
          ? parsePositiveNumber(editDraft.lomoMm, "Lomo")
          : null,
        publicLabel: editDraft.publicLabel.trim() || null,
        sortOrder: parseNonNegativeInt(editDraft.sortOrder, "Orden"),
        referenceCostPerMeter: parseNonNegativeNumber(editDraft.referenceCostPerMeter, "Costo"),
        supplierId: editDraft.supplierId,
        supplierModelCode: editDraft.supplierModelCode.trim() || null,
        active: editDraft.active,
        isPublic: editDraft.isPublic,
      };

      await apiPatch<{ success: boolean }>(`/api/admin/catalog/profiles/${frameId}`, payload);
      cancelEdit();
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error inesperado.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteFrame(frame: CatalogFrame) {
    const confirmed = window.confirm(
      `Eliminar "${buildFrameLabel(frame)}"? Esta accion no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(frame.id);
      setError(null);
      await apiDelete<{ success: boolean }>(`/api/admin/catalog/profiles/${frame.id}`);

      if (editingId === frame.id) {
        cancelEdit();
      }

      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error inesperado.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="h-8 w-full max-w-[28rem] rounded-lg bg-muted/60 ring-1 ring-border/80" aria-hidden />
        </div>
        <Button
          type="button"
          onClick={openCreateSheet}
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={editingId !== null}
        >
          <PlusIcon />
          Agregar
        </Button>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={8} rows={8} />
          ) : (
            <>
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
                    <TableHead className="h-10 px-3">Marco</TableHead>
                    <TableHead className="h-10 px-3">Tipo</TableHead>
                    <TableHead className="h-10 px-3">Frente/Prof.</TableHead>
                    <TableHead className="h-10 px-3">Bastidor</TableHead>
                    <TableHead className="h-10 px-3">Proveedor</TableHead>
                    <TableHead className="h-10 px-3">Valores x m</TableHead>
                    <TableHead className="h-10 px-3">Publico</TableHead>
                    <TableHead className="h-10 w-12 px-3 text-right">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {frames.map((frame) => {
                    const isBusy = savingId === frame.id || deletingId === frame.id || loading;

                    return (
                      <TableRow key={frame.id}>
                        <TableCell className="px-3 py-2.5">
                          <p className="leading-5 font-medium">{buildFrameLabel(frame)}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">ID: {frame.id.slice(0, 8)}</p>
                        </TableCell>

                        <TableCell className="px-3 py-2.5 text-sm leading-5">
                          {displayWood(frame.woodType)} | {displayStyle(frame.styleType)} | {displayColor(frame.colorGroup)}
                        </TableCell>

                        <TableCell className="px-3 py-2.5">
                          <div className="flex min-h-11 items-center">
                            <Badge variant="outline" className="w-fit">
                              {frame.faceMm}mm / {frame.depthMm}mm
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell className="px-3 py-2.5">
                          {frame.supportsBastidor ? (
                            <div className="space-y-1 text-xs leading-5">
                              <Badge variant="outline" className="w-fit">
                                Apto
                              </Badge>
                              <p className="text-muted-foreground">
                                Lomo: {frame.lomoMm?.toFixed(1) ?? "-"} mm
                              </p>
                            </div>
                          ) : (
                            <Badge variant="secondary">No</Badge>
                          )}
                        </TableCell>

                        <TableCell className="px-3 py-2.5">
                          <div className="space-y-1 text-sm leading-5">
                            <p className="leading-5">{frame.supplierName ?? "-"}</p>
                            {frame.supplierModelCode ? (
                              <p className="text-xs text-muted-foreground">Modelo: {frame.supplierModelCode}</p>
                            ) : null}
                          </div>
                        </TableCell>

                        <TableCell className="px-3 py-2.5">
                          <div className="space-y-1 text-xs leading-5">
                            <p>
                              <span className="text-muted-foreground">Costo:</span>{" "}
                              ${frame.referenceCostPerMeter.toFixed(2)}/m
                            </p>
                            <p>
                              <span className="text-muted-foreground">Sugerido:</span>{" "}
                              ${frame.suggestedCostPerMeter.toFixed(2)}/m
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={frame.isPublic ? "default" : "secondary"}>
                              {frame.isPublic ? "Publicado" : "Oculto"}
                            </Badge>
                            <Badge variant={frame.active ? "outline" : "secondary"}>
                              {frame.active ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell className="w-12 px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="flex size-8 items-center justify-center text-muted-foreground data-[state=open]:bg-muted"
                                    disabled={isBusy || editingId !== null}
                                    aria-label="Abrir acciones"
                                  />
                                }
                              >
                                <MoreVerticalIcon />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => void togglePublic(frame)}
                                  disabled={isBusy || editingId !== null}
                                >
                                  {frame.isPublic ? "Ocultar en catalogo" : "Publicar en catalogo"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => startEdit(frame)}
                                  disabled={editingId !== null || isBusy}
                                >
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => void deleteFrame(frame)}
                                  disabled={editingId !== null || isBusy}
                                >
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {frames.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No hay items en el catalogo.</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={editingId !== null} onOpenChange={handleEditSheetOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Editar item de catalogo</SheetTitle>
            <SheetDescription>
              Actualiza etiqueta, medida, madera, terminacion, proveedor, costo y estado.
            </SheetDescription>
          </SheetHeader>

          {editingId && editDraft ? (
            <div className="grid gap-4 p-4">
              <div className="rounded-md border border-[var(--border)]/70 bg-[var(--muted)]/20 p-3">
                <p className="text-sm font-medium leading-5">
                  {editingFrame ? buildFrameLabel(editingFrame) : "Item seleccionado"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">ID: {editingId.slice(0, 8)}</p>
              </div>

              <label className="space-y-1 text-sm">
                <span className="text-neutral-600">Etiqueta publica</span>
                <Input
                  value={editDraft.publicLabel}
                  onChange={(event) => updateDraft("publicLabel", event.target.value)}
                  placeholder={editingFrame ? buildFrameLabel(editingFrame) : "Opcional"}
                />
              </label>

              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <label className="min-w-0 space-y-1 text-sm">
                  <span className="text-neutral-600">Madera</span>
                  <Select
                    value={editDraft.woodType}
                    onValueChange={(value) => updateDraft("woodType", value as WoodType)}
                  >
                    <SelectTrigger className="h-8 w-full min-w-0">
                      <SelectValue placeholder="Madera" />
                    </SelectTrigger>
                    <SelectContent>
                      {WOOD_TYPES.map((wood) => (
                        <SelectItem key={wood} value={wood}>
                          {WOOD_LABELS[wood]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="min-w-0 space-y-1 text-sm">
                  <span className="text-neutral-600">Terminacion</span>
                  <Select
                    value={editDraft.colorGroup}
                    onValueChange={(value) => updateDraft("colorGroup", value as ColorGroup)}
                  >
                    <SelectTrigger className="h-8 w-full min-w-0">
                      <SelectValue placeholder="Terminacion" />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_GROUPS.map((color) => (
                        <SelectItem key={color} value={color}>
                          {COLOR_GROUP_LABELS[color]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <label className="min-w-0 space-y-1 text-sm">
                  <span className="text-neutral-600">Frente (mm)</span>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    className="h-8"
                    value={editDraft.faceMm}
                    onChange={(event) => updateDraft("faceMm", event.target.value)}
                  />
                </label>

                <label className="min-w-0 space-y-1 text-sm">
                  <span className="text-neutral-600">Profundidad (mm)</span>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    className="h-8"
                    value={editDraft.depthMm}
                    onChange={(event) => updateDraft("depthMm", event.target.value)}
                  />
                </label>
              </div>

              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    className="size-4 accent-primary"
                    type="checkbox"
                    checked={editDraft.supportsBastidor}
                    onChange={(event) =>
                      updateDraft("supportsBastidor", event.target.checked)
                    }
                  />
                  Apta para bastidor
                </label>

                {editDraft.supportsBastidor ? (
                  <label className="min-w-0 space-y-1 text-sm">
                    <span className="text-neutral-600">Lomo (mm)</span>
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      className="h-8"
                      value={editDraft.lomoMm}
                      onChange={(event) => updateDraft("lomoMm", event.target.value)}
                    />
                  </label>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Activa bastidor para definir el lomo.
                  </div>
                )}
              </div>

              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <label className="min-w-0 space-y-1 text-sm">
                  <span className="text-neutral-600">Proveedor</span>
                  <Select
                    value={editDraft.supplierId || NO_SUPPLIER_VALUE}
                    onValueChange={(value) =>
                      updateDraft(
                        "supplierId",
                        value === NO_SUPPLIER_VALUE ? "" : (value ?? ""),
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-full min-w-0">
                      <SelectValue placeholder="Proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SUPPLIER_VALUE}>
                        Sin proveedor
                      </SelectItem>
                      {shouldRenderEditSupplierFallback ? (
                        <SelectItem value={editDraft.supplierId}>
                          {editSupplierFallbackLabel}
                        </SelectItem>
                      ) : null}
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="min-w-0 space-y-1 text-sm">
                  <span className="text-neutral-600">Codigo modelo proveedor</span>
                  <Input
                    className="h-8 w-full"
                    value={editDraft.supplierModelCode}
                    onChange={(event) => updateDraft("supplierModelCode", event.target.value)}
                    placeholder="Opcional"
                  />
                </label>
              </div>

              <label className="space-y-1 text-sm">
                <span className="text-neutral-600">Costo proveedor x m</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editDraft.referenceCostPerMeter}
                  onChange={(event) => updateDraft("referenceCostPerMeter", event.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  El precio preliminar se recalcula automaticamente.
                </p>
              </label>

              <div className="grid gap-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    className="size-4 accent-primary"
                    type="checkbox"
                    checked={editDraft.isPublic}
                    onChange={(event) => updateDraft("isPublic", event.target.checked)}
                  />
                  Visible en catalogo
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    className="size-4 accent-primary"
                    type="checkbox"
                    checked={editDraft.active}
                    onChange={(event) => updateDraft("active", event.target.checked)}
                  />
                  Perfil activo
                </label>
              </div>
            </div>
          ) : null}

          <SheetFooter>
            <Button type="button" variant="outline" onClick={requestCloseEdit} disabled={isSavingEdit}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => (editingId ? void saveEdit(editingId) : undefined)}
              disabled={isSavingEdit || !editingId || !editDraft}
            >
              {isSavingEdit ? "Guardando..." : "Guardar cambios"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Agregar item de catalogo</SheetTitle>
            <SheetDescription>
              Crea una combinacion unica de estilo, medida, madera, terminacion y proveedor.
            </SheetDescription>
          </SheetHeader>

          {createDraft ? (
            <div className="grid gap-4 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-neutral-600">Estilo</span>
                  <Select
                    value={createDraft.styleType}
                    onValueChange={(value) =>
                      setCreateDraft((current) =>
                        current
                          ? { ...current, styleType: value as StyleType }
                          : current,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Estilo" />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLE_CODES.map((style) => (
                        <SelectItem key={style} value={style}>
                          {STYLE_LABELS[style]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-neutral-600">Madera</span>
                  <Select
                    value={createDraft.woodType}
                    onValueChange={(value) =>
                      setCreateDraft((current) =>
                        current
                          ? { ...current, woodType: value as WoodType }
                          : current,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Madera" />
                    </SelectTrigger>
                    <SelectContent>
                      {WOOD_TYPES.map((wood) => (
                        <SelectItem key={wood} value={wood}>
                          {WOOD_LABELS[wood]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-neutral-600">Frente (mm)</span>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={createDraft.faceMm}
                    onChange={(event) =>
                      setCreateDraft((current) =>
                        current
                          ? { ...current, faceMm: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-neutral-600">Profundidad (mm)</span>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={createDraft.depthMm}
                    onChange={(event) =>
                      setCreateDraft((current) =>
                        current
                          ? { ...current, depthMm: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    className="size-4 accent-primary"
                    type="checkbox"
                    checked={createDraft.supportsBastidor}
                    onChange={(event) =>
                      setCreateDraft((current) =>
                        current
                          ? {
                              ...current,
                              supportsBastidor: event.target.checked,
                              lomoMm: event.target.checked ? current.lomoMm : "",
                            }
                          : current,
                      )
                    }
                  />
                  Apta para bastidor
                </label>

                {createDraft.supportsBastidor ? (
                  <label className="space-y-1 text-sm">
                    <span className="text-neutral-600">Lomo (mm)</span>
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={createDraft.lomoMm}
                      onChange={(event) =>
                        setCreateDraft((current) =>
                          current
                            ? { ...current, lomoMm: event.target.value }
                            : current,
                        )
                      }
                    />
                  </label>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Activa bastidor para definir el lomo.
                  </div>
                )}
              </div>

              <label className="space-y-1 text-sm">
                <span className="text-neutral-600">Terminacion</span>
                <Select
                  value={createDraft.colorGroup}
                  onValueChange={(value) =>
                    setCreateDraft((current) =>
                      current
                        ? { ...current, colorGroup: value as ColorGroup }
                        : current,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Terminacion" />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_GROUPS.map((color) => (
                      <SelectItem key={color} value={color}>
                        {COLOR_GROUP_LABELS[color]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <label className="min-w-0 space-y-1 text-sm">
                  <span className="text-neutral-600">Proveedor</span>
                  <Select
                    value={createDraft.supplierId || NO_SUPPLIER_VALUE}
                    onValueChange={(value) =>
                      setCreateDraft((current) =>
                        current
                          ? {
                              ...current,
                              supplierId:
                                value === NO_SUPPLIER_VALUE ? "" : (value ?? ""),
                            }
                          : current,
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue placeholder="Proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SUPPLIER_VALUE}>
                        Sin proveedor
                      </SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="min-w-0 space-y-1 text-sm">
                  <span className="text-neutral-600">Codigo modelo proveedor</span>
                  <Input
                    className="h-8 w-full"
                    value={createDraft.supplierModelCode}
                    onChange={(event) =>
                      setCreateDraft((current) =>
                        current
                          ? { ...current, supplierModelCode: event.target.value }
                          : current,
                      )
                    }
                    placeholder="Opcional"
                  />
                </label>
              </div>

              <label className="space-y-1 text-sm">
                <span className="text-neutral-600">Costo proveedor x m</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={createDraft.referenceCostPerMeter}
                  onChange={(event) =>
                    setCreateDraft((current) =>
                      current
                        ? { ...current, referenceCostPerMeter: event.target.value }
                        : current,
                    )
                  }
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-neutral-600">Etiqueta publica</span>
                <Input
                  value={createDraft.publicLabel}
                  onChange={(event) =>
                    setCreateDraft((current) =>
                      current
                        ? { ...current, publicLabel: event.target.value }
                        : current,
                    )
                  }
                  placeholder="Opcional"
                />
              </label>

              <div className="grid gap-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    className="size-4 accent-primary"
                    type="checkbox"
                    checked={createDraft.isPublic}
                    onChange={(event) =>
                      setCreateDraft((current) =>
                        current
                          ? { ...current, isPublic: event.target.checked }
                          : current,
                      )
                    }
                  />
                  Visible en catalogo
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    className="size-4 accent-primary"
                    type="checkbox"
                    checked={createDraft.active}
                    onChange={(event) =>
                      setCreateDraft((current) =>
                        current
                          ? { ...current, active: event.target.checked }
                          : current,
                      )
                    }
                  />
                  Perfil activo
                </label>
              </div>

              {createDraft.referenceCostPerMeter.trim() !== "" && Number.isFinite(Number(createDraft.referenceCostPerMeter)) ? (
                <p className="rounded-md border border-[var(--border)] p-2 text-xs text-muted-foreground">
                  Precio preliminar estimado (factor 1.80): ${(
                    Number(createDraft.referenceCostPerMeter || 0) * 1.8
                  ).toFixed(2)}
                  /m
                </p>
              ) : null}
            </div>
          ) : null}

          <SheetFooter>
            <Button type="button" variant="outline" onClick={closeCreateSheet} disabled={creating}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void createFrame()} disabled={creating || !createDraft}>
              {creating ? "Guardando..." : "Crear item"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
