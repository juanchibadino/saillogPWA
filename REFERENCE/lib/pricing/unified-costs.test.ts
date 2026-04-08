import test from "node:test";
import assert from "node:assert/strict";
import {
  CatalogPricingConfigurationError,
  type CatalogCostReader,
  loadUnifiedReferenceCosts,
} from "@/lib/pricing/unified-costs";

type MockRow = {
  id: string;
  catalog_frame_id: string | null;
  glass_type_id: string | null;
  matboard_type_id: string | null;
  catalog_item_cost_metrics:
    | { reference_cost_per_unit: number | string | null }
    | Array<{ reference_cost_per_unit: number | string | null }>
    | null;
};

type MockErrorMap = Partial<
  Record<"catalog_frame_id" | "glass_type_id" | "matboard_type_id", string>
>;

function createMockSupabase(
  rowsByColumn: Partial<Record<"catalog_frame_id" | "glass_type_id" | "matboard_type_id", MockRow[]>>,
  errors: MockErrorMap = {},
): CatalogCostReader {
  return {
    from(table: "catalog_items") {
      assert.equal(table, "catalog_items");

      return {
        select() {
          return {
            in(column, values) {
              const errorMessage = errors[column];

              if (errorMessage) {
                return Promise.resolve({
                  data: null,
                  error: { message: errorMessage },
                });
              }

              const rows = (rowsByColumn[column] ?? []).filter((row) => {
                const value = row[column];
                return value ? values.includes(value) : false;
              });

              return Promise.resolve({
                data: rows,
                error: null,
              });
            },
          };
        },
      };
    },
  };
}

test("loadUnifiedReferenceCosts returns reference costs for frame, glass and matboard", async () => {
  const supabase = createMockSupabase({
    catalog_frame_id: [
      {
        id: "ci-frame",
        catalog_frame_id: "frame-1",
        glass_type_id: null,
        matboard_type_id: null,
        catalog_item_cost_metrics: { reference_cost_per_unit: 120 },
      },
    ],
    glass_type_id: [
      {
        id: "ci-glass",
        catalog_frame_id: null,
        glass_type_id: "glass-1",
        matboard_type_id: null,
        catalog_item_cost_metrics: [{ reference_cost_per_unit: "88.5" }],
      },
    ],
    matboard_type_id: [
      {
        id: "ci-matboard",
        catalog_frame_id: null,
        glass_type_id: null,
        matboard_type_id: "matboard-1",
        catalog_item_cost_metrics: { reference_cost_per_unit: 44.25 },
      },
    ],
  });

  const result = await loadUnifiedReferenceCosts(supabase, {
    frameCatalogIds: ["frame-1"],
    glassTypeIds: ["glass-1"],
    matboardTypeIds: ["matboard-1"],
  });

  assert.equal(result.frameCostPerMeterByFrameId.get("frame-1"), 120);
  assert.equal(result.glassCostPerSquareMByTypeId.get("glass-1"), 88.5);
  assert.equal(result.matboardCostPerSquareMByTypeId.get("matboard-1"), 44.25);
});

test("loadUnifiedReferenceCosts throws when a catalog item mapping is missing", async () => {
  const supabase = createMockSupabase({
    catalog_frame_id: [
      {
        id: "ci-frame",
        catalog_frame_id: "frame-1",
        glass_type_id: null,
        matboard_type_id: null,
        catalog_item_cost_metrics: { reference_cost_per_unit: 120 },
      },
    ],
  });

  await assert.rejects(
    () =>
      loadUnifiedReferenceCosts(supabase, {
        frameCatalogIds: ["frame-1"],
        glassTypeIds: ["glass-missing"],
      }),
    (error: unknown) => {
      assert.ok(error instanceof CatalogPricingConfigurationError);
      assert.equal(error.message, "Missing catalog item mapping for pricing.");
      assert.deepEqual(error.details, {
        frameCatalogIds: [],
        glassTypeIds: ["glass-missing"],
        matboardTypeIds: [],
      });
      return true;
    },
  );
});

test("loadUnifiedReferenceCosts throws when reference_cost_per_unit metric is missing", async () => {
  const supabase = createMockSupabase({
    matboard_type_id: [
      {
        id: "ci-matboard",
        catalog_frame_id: null,
        glass_type_id: null,
        matboard_type_id: "matboard-1",
        catalog_item_cost_metrics: null,
      },
    ],
  });

  await assert.rejects(
    () =>
      loadUnifiedReferenceCosts(supabase, {
        matboardTypeIds: ["matboard-1"],
      }),
    (error: unknown) => {
      assert.ok(error instanceof CatalogPricingConfigurationError);
      assert.equal(
        error.message,
        "Missing reference_cost_per_unit in catalog_item_cost_metrics.",
      );
      assert.deepEqual(error.details, {
        frameCatalogIds: [],
        glassTypeIds: [],
        matboardTypeIds: ["matboard-1"],
      });
      return true;
    },
  );
});
