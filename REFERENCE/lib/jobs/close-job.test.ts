import test from "node:test";
import assert from "node:assert/strict";
import {
  buildJobCloseTotals,
  calculateActualLaborCost,
  validateJobForClosure,
} from "@/lib/jobs/close-job";

test("calculateActualLaborCost uses the fixed ARS hourly rate", () => {
  assert.equal(calculateActualLaborCost(60), 42300);
  assert.equal(calculateActualLaborCost(90), 63450);
});

test("validateJobForClosure blocks closing when stages or materials are incomplete", () => {
  const result = validateJobForClosure(
    [
      { status: "done", actualMinutes: 30 },
      { status: "pending", actualMinutes: null },
    ],
    [{ jobItemId: "item-1", consumed: false, actualCost: 100 }],
  );

  assert.equal(result.canClose, false);
  assert.equal(result.allStagesDone, false);
  assert.equal(result.allMaterialsUsed, false);
  assert.equal(result.blockers.length, 2);
});

test("buildJobCloseTotals aggregates material costs by item and real minutes", () => {
  const result = buildJobCloseTotals({
    projectedRevenue: 100000,
    stages: [
      { status: "done", actualMinutes: 60 },
      { status: "done", actualMinutes: 30 },
    ],
    materials: [
      { jobItemId: "item-1", consumed: true, actualCost: 1500 },
      { jobItemId: "item-1", consumed: true, actualCost: 250 },
      { jobItemId: "item-2", consumed: true, actualCost: 500 },
    ],
  });

  assert.equal(result.actualMaterialCost, 2250);
  assert.equal(result.actualLaborCost, 63450);
  assert.equal(result.actualTotalCost, 65700);
  assert.equal(result.actualMargin, 34300);
  assert.equal(result.totalActualMinutes, 90);
  assert.deepEqual(result.itemActualCosts, [
    { jobItemId: "item-1", materialCost: 1750, laborCost: 0 },
    { jobItemId: "item-2", materialCost: 500, laborCost: 0 },
  ]);
});
