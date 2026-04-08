type CatalogItemCostMetricRow = {
  reference_cost_per_unit: number | string | null;
};

type CatalogItemCostRow = {
  id: string;
  catalog_frame_id: string | null;
  glass_type_id: string | null;
  matboard_type_id: string | null;
  catalog_item_cost_metrics: CatalogItemCostMetricRow[] | CatalogItemCostMetricRow | null;
};

type QueryError = {
  message: string;
};

type QueryResult = PromiseLike<{
  data: CatalogItemCostRow[] | null;
  error: QueryError | null;
}>;

type CatalogItemTable = {
  select(columns: string): {
    in(
      column: "catalog_frame_id" | "glass_type_id" | "matboard_type_id",
      values: string[],
    ): QueryResult;
  };
};

export type CatalogCostReader = {
  from(table: "catalog_items"): CatalogItemTable;
};

export type UnifiedReferenceCostInput = {
  frameCatalogIds?: string[];
  glassTypeIds?: string[];
  matboardTypeIds?: string[];
};

export type UnifiedReferenceCostMaps = {
  frameCostPerMeterByFrameId: Map<string, number>;
  glassCostPerSquareMByTypeId: Map<string, number>;
  matboardCostPerSquareMByTypeId: Map<string, number>;
};

export class CatalogPricingConfigurationError extends Error {
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = "CatalogPricingConfigurationError";
    this.details = details;
  }
}

function uniqueIds(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).filter((value) => Boolean(value))));
}

function normalizeMetric(
  relation: CatalogItemCostRow["catalog_item_cost_metrics"],
): CatalogItemCostMetricRow | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

function readReferenceCost(
  relation: CatalogItemCostRow["catalog_item_cost_metrics"],
): number | null {
  const metric = normalizeMetric(relation);

  if (!metric) {
    return null;
  }

  if (
    metric.reference_cost_per_unit === null ||
    metric.reference_cost_per_unit === undefined
  ) {
    return null;
  }

  const parsed = Number(metric.reference_cost_per_unit);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loadUnifiedReferenceCosts(
  supabase: CatalogCostReader,
  input: UnifiedReferenceCostInput,
): Promise<UnifiedReferenceCostMaps> {
  const frameCatalogIds = uniqueIds(input.frameCatalogIds);
  const glassTypeIds = uniqueIds(input.glassTypeIds);
  const matboardTypeIds = uniqueIds(input.matboardTypeIds);

  const empty = {
    data: [] as CatalogItemCostRow[],
    error: null,
  };

  const [frameResult, glassResult, matboardResult] = await Promise.all([
    frameCatalogIds.length > 0
      ? supabase
          .from("catalog_items")
          .select(
            "id, catalog_frame_id, glass_type_id, matboard_type_id, catalog_item_cost_metrics(reference_cost_per_unit)",
          )
          .in("catalog_frame_id", frameCatalogIds)
      : Promise.resolve(empty),
    glassTypeIds.length > 0
      ? supabase
          .from("catalog_items")
          .select(
            "id, catalog_frame_id, glass_type_id, matboard_type_id, catalog_item_cost_metrics(reference_cost_per_unit)",
          )
          .in("glass_type_id", glassTypeIds)
      : Promise.resolve(empty),
    matboardTypeIds.length > 0
      ? supabase
          .from("catalog_items")
          .select(
            "id, catalog_frame_id, glass_type_id, matboard_type_id, catalog_item_cost_metrics(reference_cost_per_unit)",
          )
          .in("matboard_type_id", matboardTypeIds)
      : Promise.resolve(empty),
  ]);

  if (frameResult.error || glassResult.error || matboardResult.error) {
    throw new CatalogPricingConfigurationError(
      "Failed to load catalog item mappings for pricing.",
      {
        frame: frameResult.error?.message ?? null,
        glass: glassResult.error?.message ?? null,
        matboard: matboardResult.error?.message ?? null,
      },
    );
  }

  const frameCostPerMeterByFrameId = new Map<string, number>();
  const glassCostPerSquareMByTypeId = new Map<string, number>();
  const matboardCostPerSquareMByTypeId = new Map<string, number>();
  const mappedFrameIds = new Set<string>();
  const mappedGlassTypeIds = new Set<string>();
  const mappedMatboardTypeIds = new Set<string>();

  const missingMetricFrameIds: string[] = [];
  const missingMetricGlassTypeIds: string[] = [];
  const missingMetricMatboardTypeIds: string[] = [];

  for (const row of frameResult.data ?? []) {
    if (!row.catalog_frame_id) {
      continue;
    }

    mappedFrameIds.add(row.catalog_frame_id);

    const referenceCost = readReferenceCost(row.catalog_item_cost_metrics);

    if (referenceCost === null) {
      missingMetricFrameIds.push(row.catalog_frame_id);
      continue;
    }

    frameCostPerMeterByFrameId.set(row.catalog_frame_id, referenceCost);
  }

  for (const row of glassResult.data ?? []) {
    if (!row.glass_type_id) {
      continue;
    }

    mappedGlassTypeIds.add(row.glass_type_id);

    const referenceCost = readReferenceCost(row.catalog_item_cost_metrics);

    if (referenceCost === null) {
      missingMetricGlassTypeIds.push(row.glass_type_id);
      continue;
    }

    glassCostPerSquareMByTypeId.set(row.glass_type_id, referenceCost);
  }

  for (const row of matboardResult.data ?? []) {
    if (!row.matboard_type_id) {
      continue;
    }

    mappedMatboardTypeIds.add(row.matboard_type_id);

    const referenceCost = readReferenceCost(row.catalog_item_cost_metrics);

    if (referenceCost === null) {
      missingMetricMatboardTypeIds.push(row.matboard_type_id);
      continue;
    }

    matboardCostPerSquareMByTypeId.set(row.matboard_type_id, referenceCost);
  }

  const missingFrameMappings = frameCatalogIds.filter(
    (id) => !mappedFrameIds.has(id),
  );
  const missingGlassMappings = glassTypeIds.filter(
    (id) => !mappedGlassTypeIds.has(id),
  );
  const missingMatboardMappings = matboardTypeIds.filter(
    (id) => !mappedMatboardTypeIds.has(id),
  );

  if (
    missingFrameMappings.length > 0 ||
    missingGlassMappings.length > 0 ||
    missingMatboardMappings.length > 0
  ) {
    throw new CatalogPricingConfigurationError(
      "Missing catalog item mapping for pricing.",
      {
        frameCatalogIds: missingFrameMappings,
        glassTypeIds: missingGlassMappings,
        matboardTypeIds: missingMatboardMappings,
      },
    );
  }

  if (
    missingMetricFrameIds.length > 0 ||
    missingMetricGlassTypeIds.length > 0 ||
    missingMetricMatboardTypeIds.length > 0
  ) {
    throw new CatalogPricingConfigurationError(
      "Missing reference_cost_per_unit in catalog_item_cost_metrics.",
      {
        frameCatalogIds: missingMetricFrameIds,
        glassTypeIds: missingMetricGlassTypeIds,
        matboardTypeIds: missingMetricMatboardTypeIds,
      },
    );
  }

  return {
    frameCostPerMeterByFrameId,
    glassCostPerSquareMByTypeId,
    matboardCostPerSquareMByTypeId,
  };
}
