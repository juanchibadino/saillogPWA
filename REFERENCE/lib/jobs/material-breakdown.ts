import { calculateFrameGeometry } from "@/lib/pricing/frame-geometry";
import { round2, round4 } from "@/lib/utils/math";
import type { BastidorSnapshot } from "@/types/domain";

export type JobMaterialUnit = "m" | "m2";
export type JobMaterialKind = "frame" | "glass" | "matboard";

export type JobLeadItemMaterialContext = {
  faceMm: number | null;
  hasGlass: boolean;
  hasMatboard: boolean;
  matboardBorderCm: number | null;
  glassTypeId: string | null;
  matboardTypeId: string | null;
  assemblyMode: string | null;
  bastidorVariant: string | null;
  bastidorLightCm: number | null;
  bastidorSecondaryFrameCatalogId: string | null;
  bastidorSupportMm: number | null;
  bastidorLomoMm: number | null;
  bastidorDepthMm: number | null;
};

export type JobItemMaterialContext = {
  id: string;
  widthCm: number;
  heightCm: number;
  quantity: number;
  frameCatalogId: string;
  leadItem: JobLeadItemMaterialContext | null;
};

export type MaterialCatalogItemProjection = {
  id: string;
  kind: JobMaterialKind;
  unit: JobMaterialUnit;
  displayName: string;
  suggestedCostPerUnit: number;
};

export type ComputedJobMaterial = {
  key: string;
  jobItemId: string;
  catalogItemId: string;
  kind: JobMaterialKind;
  label: string;
  unit: JobMaterialUnit;
  requiredQuantity: number;
  onHandQuantity: number;
  pieceCount: number;
  metersPerPiece: number | null;
  widthCm: number | null;
  heightCm: number | null;
  suggestedCostPerUnit: number;
};

export type JobMaterialUsageMovement = {
  catalogItemId: string;
  jobItemId: string | null;
  quantityConsumed: number;
  unitCost: number | null;
  totalCost: number | null;
};

export type JobMaterialUsageSummary = {
  consumed: boolean;
  consumedQuantity: number;
  actualCost: number;
};

type MaterialDraft = {
  key: string;
  jobItemId: string;
  catalogItemId: string;
  kind: JobMaterialKind;
  unit: JobMaterialUnit;
  requiredQuantity: number;
  onHandQuantity: number;
  pieceCount: number;
  metersPerPiece: number | null;
  widthCm: number | null;
  heightCm: number | null;
  labels: string[];
  suggestedCostPerUnit: number;
};

function buildBastidorSnapshot(
  leadItem: JobLeadItemMaterialContext | null,
): BastidorSnapshot | null {
  if (!leadItem || leadItem.assemblyMode !== "bastidor") {
    return null;
  }

  if (
    (leadItem.bastidorVariant !== "simple" &&
      leadItem.bastidorVariant !== "double_profile") ||
    leadItem.bastidorLightCm === null ||
    leadItem.bastidorSupportMm === null ||
    leadItem.bastidorLomoMm === null ||
    leadItem.bastidorDepthMm === null
  ) {
    return null;
  }

  return {
    variant: leadItem.bastidorVariant,
    lightCm: leadItem.bastidorLightCm,
    supportMm: leadItem.bastidorSupportMm,
    lomoMm: leadItem.bastidorLomoMm,
    depthMm: leadItem.bastidorDepthMm,
    secondaryFrameId: leadItem.bastidorSecondaryFrameCatalogId ?? null,
  };
}

export function buildJobMaterialUsageKey(jobItemId: string, catalogItemId: string) {
  return `${jobItemId}:${catalogItemId}`;
}

function mergeMaterialDraft(
  drafts: MaterialDraft[],
  nextDraft: Omit<MaterialDraft, "labels"> & { label: string },
) {
  const existing = drafts.find(
    (draft) =>
      draft.jobItemId === nextDraft.jobItemId &&
      draft.catalogItemId === nextDraft.catalogItemId,
  );

  if (!existing) {
    drafts.push({
      ...nextDraft,
      labels: [nextDraft.label],
    });
    return;
  }

  existing.requiredQuantity = round4(
    existing.requiredQuantity + nextDraft.requiredQuantity,
  );
  existing.pieceCount += nextDraft.pieceCount;
  existing.onHandQuantity = nextDraft.onHandQuantity;
  existing.suggestedCostPerUnit = nextDraft.suggestedCostPerUnit;

  if (!existing.labels.includes(nextDraft.label)) {
    existing.labels.push(nextDraft.label);
  }

  if (existing.unit === "m" && existing.pieceCount > 0) {
    existing.metersPerPiece = round4(existing.requiredQuantity / existing.pieceCount);
  }
}

export function buildJobItemMaterials(
  item: JobItemMaterialContext,
  options: {
    frameCatalogItems: Map<string, MaterialCatalogItemProjection>;
    glassCatalogItems: Map<string, MaterialCatalogItemProjection>;
    matboardCatalogItems: Map<string, MaterialCatalogItemProjection>;
    onHandByCatalogItemId: Map<string, number>;
  },
): ComputedJobMaterial[] {
  const primaryFrameCatalogItem = options.frameCatalogItems.get(item.frameCatalogId);

  if (!primaryFrameCatalogItem) {
    throw new Error(`No catalog item mapping found for frame ${item.frameCatalogId}.`);
  }

  const geometry = calculateFrameGeometry({
    widthCm: item.widthCm,
    heightCm: item.heightCm,
    quantity: item.quantity,
    hasMatboard: item.leadItem?.hasMatboard ?? false,
    matboardBorderCm: item.leadItem?.matboardBorderCm ?? 0,
    frameFaceMm: item.leadItem?.faceMm ?? 0,
    assemblyMode:
      item.leadItem?.assemblyMode === "bastidor" ? "bastidor" : "normal",
    bastidor: buildBastidorSnapshot(item.leadItem),
  });

  const drafts: MaterialDraft[] = [];
  const pieceCount = Math.max(item.quantity, 1);

  function buildFrameDraft(
    catalogItem: MaterialCatalogItemProjection,
    label: string,
  ) {
    return {
      key: buildJobMaterialUsageKey(item.id, catalogItem.id),
      jobItemId: item.id,
      catalogItemId: catalogItem.id,
      kind: catalogItem.kind,
      unit: catalogItem.unit,
      requiredQuantity: round4(geometry.requiredMouldingM),
      onHandQuantity: round4(
        options.onHandByCatalogItemId.get(catalogItem.id) ?? 0,
      ),
      pieceCount,
      metersPerPiece: round4(geometry.requiredMouldingM / pieceCount),
      widthCm: null,
      heightCm: null,
      suggestedCostPerUnit: catalogItem.suggestedCostPerUnit,
      label,
    };
  }

  mergeMaterialDraft(
    drafts,
    buildFrameDraft(primaryFrameCatalogItem, `Frame: ${primaryFrameCatalogItem.displayName}`),
  );

  if (item.leadItem?.bastidorSecondaryFrameCatalogId) {
    const secondaryFrameCatalogItem = options.frameCatalogItems.get(
      item.leadItem.bastidorSecondaryFrameCatalogId,
    );

    if (!secondaryFrameCatalogItem) {
      throw new Error(
        `No catalog item mapping found for frame ${item.leadItem.bastidorSecondaryFrameCatalogId}.`,
      );
    }

    mergeMaterialDraft(
      drafts,
      buildFrameDraft(
        secondaryFrameCatalogItem,
        `Support frame: ${secondaryFrameCatalogItem.displayName}`,
      ),
    );
  }

  if (item.leadItem?.hasGlass && item.leadItem.glassTypeId) {
    const glassCatalogItem = options.glassCatalogItems.get(item.leadItem.glassTypeId);

    if (!glassCatalogItem) {
      throw new Error(
        `No catalog item mapping found for glass ${item.leadItem.glassTypeId}.`,
      );
    }

    mergeMaterialDraft(drafts, {
      key: buildJobMaterialUsageKey(item.id, glassCatalogItem.id),
      jobItemId: item.id,
      catalogItemId: glassCatalogItem.id,
      kind: glassCatalogItem.kind,
      label: `Glass: ${glassCatalogItem.displayName}`,
      unit: glassCatalogItem.unit,
      requiredQuantity: round4(geometry.areaM2),
      onHandQuantity: round4(options.onHandByCatalogItemId.get(glassCatalogItem.id) ?? 0),
      pieceCount,
      metersPerPiece: null,
      widthCm: round4(geometry.outerWidthCm),
      heightCm: round4(geometry.outerHeightCm),
      suggestedCostPerUnit: glassCatalogItem.suggestedCostPerUnit,
    });
  }

  if (item.leadItem?.hasMatboard && item.leadItem.matboardTypeId) {
    const matboardCatalogItem = options.matboardCatalogItems.get(
      item.leadItem.matboardTypeId,
    );

    if (!matboardCatalogItem) {
      throw new Error(
        `No catalog item mapping found for matboard ${item.leadItem.matboardTypeId}.`,
      );
    }

    mergeMaterialDraft(drafts, {
      key: buildJobMaterialUsageKey(item.id, matboardCatalogItem.id),
      jobItemId: item.id,
      catalogItemId: matboardCatalogItem.id,
      kind: matboardCatalogItem.kind,
      label: `Matboard: ${matboardCatalogItem.displayName}`,
      unit: matboardCatalogItem.unit,
      requiredQuantity: round4(geometry.areaM2),
      onHandQuantity: round4(
        options.onHandByCatalogItemId.get(matboardCatalogItem.id) ?? 0,
      ),
      pieceCount,
      metersPerPiece: null,
      widthCm: round4(geometry.outerWidthCm),
      heightCm: round4(geometry.outerHeightCm),
      suggestedCostPerUnit: matboardCatalogItem.suggestedCostPerUnit,
    });
  }

  return drafts.map((draft) => ({
    key: draft.key,
    jobItemId: draft.jobItemId,
    catalogItemId: draft.catalogItemId,
    kind: draft.kind,
    label: draft.labels.join(" + "),
    unit: draft.unit,
    requiredQuantity: round4(draft.requiredQuantity),
    onHandQuantity: round4(draft.onHandQuantity),
    pieceCount: draft.pieceCount,
    metersPerPiece: draft.unit === "m" ? round4(draft.requiredQuantity / draft.pieceCount) : null,
    widthCm: draft.widthCm,
    heightCm: draft.heightCm,
    suggestedCostPerUnit: draft.suggestedCostPerUnit,
  }));
}

function resolveUnitCost(
  movement: JobMaterialUsageMovement,
  suggestedCostPerUnit: number,
): number {
  if (movement.unitCost !== null) {
    return movement.unitCost;
  }

  if (movement.totalCost !== null && movement.quantityConsumed > 0) {
    return round4(movement.totalCost / movement.quantityConsumed);
  }

  return suggestedCostPerUnit;
}

export function summarizeJobMaterialUsage(
  materials: ComputedJobMaterial[],
  movements: JobMaterialUsageMovement[],
): Map<string, JobMaterialUsageSummary> {
  const summary = new Map<string, JobMaterialUsageSummary>();
  const materialByKey = new Map(materials.map((material) => [material.key, material]));

  for (const material of materials) {
    summary.set(material.key, {
      consumed: false,
      consumedQuantity: 0,
      actualCost: 0,
    });
  }

  const directMovements = movements.filter((movement) => movement.jobItemId !== null);

  for (const movement of directMovements) {
    const key = buildJobMaterialUsageKey(
      movement.jobItemId as string,
      movement.catalogItemId,
    );
    const material = materialByKey.get(key);
    const row = summary.get(key);

    if (!material || !row) {
      continue;
    }

    const quantityConsumed = round4(
      row.consumedQuantity + Math.abs(movement.quantityConsumed),
    );
    const unitCost = resolveUnitCost(movement, material.suggestedCostPerUnit);
    const actualCost = round2(
      row.actualCost +
        (movement.totalCost !== null
          ? movement.totalCost
          : Math.abs(movement.quantityConsumed) * unitCost),
    );

    row.consumedQuantity = quantityConsumed;
    row.actualCost = actualCost;
    row.consumed = quantityConsumed + 0.0001 >= material.requiredQuantity;
  }

  const legacyMovements = movements.filter((movement) => movement.jobItemId === null);
  const materialsByCatalogItem = new Map<string, ComputedJobMaterial[]>();

  for (const material of materials) {
    const group = materialsByCatalogItem.get(material.catalogItemId) ?? [];
    group.push(material);
    materialsByCatalogItem.set(material.catalogItemId, group);
  }

  for (const movement of legacyMovements) {
    const candidates = materialsByCatalogItem.get(movement.catalogItemId) ?? [];
    let remainingQuantity = round4(Math.abs(movement.quantityConsumed));

    for (const material of candidates) {
      if (remainingQuantity <= 0) {
        break;
      }

      const row = summary.get(material.key);

      if (!row) {
        continue;
      }

      const remainingRequired = round4(
        Math.max(material.requiredQuantity - row.consumedQuantity, 0),
      );

      if (remainingRequired <= 0) {
        continue;
      }

      const allocatedQuantity = round4(Math.min(remainingRequired, remainingQuantity));
      const unitCost = resolveUnitCost(movement, material.suggestedCostPerUnit);

      row.consumedQuantity = round4(row.consumedQuantity + allocatedQuantity);
      row.actualCost = round2(row.actualCost + allocatedQuantity * unitCost);
      row.consumed = row.consumedQuantity + 0.0001 >= material.requiredQuantity;

      remainingQuantity = round4(remainingQuantity - allocatedQuantity);
    }
  }

  return summary;
}
