import test from "node:test";
import assert from "node:assert/strict";
import {
  buildJobItemMaterials,
  buildJobMaterialUsageKey,
  summarizeJobMaterialUsage,
  type ComputedJobMaterial,
} from "@/lib/jobs/material-breakdown";

function makeMaterial(
  overrides: Partial<ComputedJobMaterial>,
): ComputedJobMaterial {
  return {
    key: buildJobMaterialUsageKey("job-item-1", "catalog-item-1"),
    jobItemId: "job-item-1",
    catalogItemId: "catalog-item-1",
    kind: "frame",
    label: "Frame: Kiri",
    unit: "m",
    requiredQuantity: 1,
    onHandQuantity: 10,
    pieceCount: 1,
    metersPerPiece: 1,
    widthCm: null,
    heightCm: null,
    suggestedCostPerUnit: 100,
    ...overrides,
  };
}

test("buildJobItemMaterials returns frame, glass, and matboard rows with purchase prefills", () => {
  const materials = buildJobItemMaterials(
    {
      id: "job-item-1",
      widthCm: 50,
      heightCm: 70,
      quantity: 2,
      frameCatalogId: "frame-primary",
      leadItem: {
        faceMm: 24,
        hasGlass: true,
        hasMatboard: true,
        matboardBorderCm: 5,
        glassTypeId: "glass-clear",
        matboardTypeId: "mat-white",
        assemblyMode: "normal",
        bastidorVariant: null,
        bastidorLightCm: null,
        bastidorSecondaryFrameCatalogId: null,
        bastidorSupportMm: null,
        bastidorLomoMm: null,
        bastidorDepthMm: null,
      },
    },
    {
      frameCatalogItems: new Map([
        [
          "frame-primary",
          {
            id: "catalog-frame-primary",
            kind: "frame",
            unit: "m",
            displayName: "Kiri Natural",
            suggestedCostPerUnit: 110,
          },
        ],
      ]),
      glassCatalogItems: new Map([
        [
          "glass-clear",
          {
            id: "catalog-glass-clear",
            kind: "glass",
            unit: "m2",
            displayName: "Clear glass",
            suggestedCostPerUnit: 60,
          },
        ],
      ]),
      matboardCatalogItems: new Map([
        [
          "mat-white",
          {
            id: "catalog-mat-white",
            kind: "matboard",
            unit: "m2",
            displayName: "White matboard",
            suggestedCostPerUnit: 35,
          },
        ],
      ]),
      onHandByCatalogItemId: new Map([
        ["catalog-frame-primary", 25],
        ["catalog-glass-clear", 10],
        ["catalog-mat-white", 8],
      ]),
    },
  );

  assert.equal(materials.length, 3);

  const frame = materials.find((material) => material.kind === "frame");
  const glass = materials.find((material) => material.kind === "glass");
  const matboard = materials.find((material) => material.kind === "matboard");

  assert.ok(frame);
  assert.ok(glass);
  assert.ok(matboard);

  assert.equal(frame.pieceCount, 2);
  assert.ok(frame.metersPerPiece !== null);
  assert.equal(frame.onHandQuantity, 25);

  assert.equal(glass.pieceCount, 2);
  assert.ok(glass.widthCm !== null && glass.widthCm > 50);
  assert.ok(glass.heightCm !== null && glass.heightCm > 70);

  assert.equal(matboard.pieceCount, 2);
  assert.equal(matboard.onHandQuantity, 8);
});

test("summarizeJobMaterialUsage keeps row-level usage separate and falls back to suggested cost", () => {
  const item1 = makeMaterial({
    key: buildJobMaterialUsageKey("job-item-1", "catalog-frame"),
    jobItemId: "job-item-1",
    catalogItemId: "catalog-frame",
    requiredQuantity: 2,
    suggestedCostPerUnit: 100,
  });
  const item2 = makeMaterial({
    key: buildJobMaterialUsageKey("job-item-2", "catalog-frame"),
    jobItemId: "job-item-2",
    catalogItemId: "catalog-frame",
    requiredQuantity: 1,
    suggestedCostPerUnit: 100,
  });

  const summary = summarizeJobMaterialUsage(
    [item1, item2],
    [
      {
        catalogItemId: "catalog-frame",
        jobItemId: "job-item-1",
        quantityConsumed: 2,
        unitCost: null,
        totalCost: null,
      },
      {
        catalogItemId: "catalog-frame",
        jobItemId: null,
        quantityConsumed: 1,
        unitCost: 120,
        totalCost: null,
      },
    ],
  );

  assert.deepEqual(summary.get(item1.key), {
    consumed: true,
    consumedQuantity: 2,
    actualCost: 200,
  });
  assert.deepEqual(summary.get(item2.key), {
    consumed: true,
    consumedQuantity: 1,
    actualCost: 120,
  });
});
