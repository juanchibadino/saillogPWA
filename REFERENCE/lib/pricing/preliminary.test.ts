import test from "node:test";
import assert from "node:assert/strict";
import { calculatePreliminaryPricing } from "@/lib/pricing/preliminary";

test("calculatePreliminaryPricing without glass or matboard", () => {
  const result = calculatePreliminaryPricing({
    widthCm: 40,
    heightCm: 30,
    quantity: 1,
    hasGlass: false,
    hasMatboard: false,
    frame: {
      id: "frame-1",
      faceMm: 20,
      referencePricePerMeter: 100,
      referenceCostPerMeter: 100,
    },
  });

  assert.equal(result.outerWidthCm, 44);
  assert.equal(result.outerHeightCm, 34);
  assert.equal(result.perimeterCm, 156);
  assert.equal(result.requiredMouldingCm, 171.6);
  assert.equal(result.requiredMouldingM, 1.72);
  assert.equal(result.areaM2, 0.15);
  assert.equal(result.frameCost, 171.6);
  assert.equal(result.glassCost, 0);
  assert.equal(result.matboardCost, 0);
  assert.equal(result.preliminaryPrice, 171.6);
});

test("calculatePreliminaryPricing with matboard and glass uses outer dimensions", () => {
  const result = calculatePreliminaryPricing({
    widthCm: 60,
    heightCm: 40,
    quantity: 1,
    hasGlass: true,
    hasMatboard: true,
    matboardBorderCm: 5,
    frame: {
      id: "frame-2",
      faceMm: 30,
      referencePricePerMeter: 200,
      referenceCostPerMeter: 200,
    },
    glassCostPerSquareM: 100,
    matboardCostPerSquareM: 50,
  });

  assert.equal(result.outerWidthCm, 76);
  assert.equal(result.outerHeightCm, 56);
  assert.equal(result.perimeterCm, 264);
  assert.equal(result.requiredMouldingCm, 290.4);
  assert.equal(result.requiredMouldingM, 2.9);
  assert.equal(result.areaM2, 0.43);
  assert.equal(result.frameCost, 580.8);
  assert.equal(result.glassCost, 42.56);
  assert.equal(result.matboardCost, 21.28);
  assert.equal(result.projectedCost, 644.64);
  assert.equal(result.preliminaryPrice, 644.64);
});

test("calculatePreliminaryPricing scales by quantity", () => {
  const result = calculatePreliminaryPricing({
    widthCm: 20,
    heightCm: 20,
    quantity: 3,
    hasGlass: true,
    hasMatboard: false,
    frame: {
      id: "frame-3",
      faceMm: 10,
      referencePricePerMeter: 10,
      referenceCostPerMeter: 10,
    },
    glassCostPerSquareM: 30,
  });

  assert.equal(result.requiredMouldingCm, 290.4);
  assert.equal(result.requiredMouldingM, 2.9);
  assert.equal(result.areaM2, 0.15);
  assert.equal(result.frameCost, 29.04);
  assert.equal(result.glassCost, 4.36);
  assert.equal(result.projectedCost, 33.4);
});

test("calculatePreliminaryPricing rounds total to 2 decimals", () => {
  const result = calculatePreliminaryPricing({
    widthCm: 10,
    heightCm: 10,
    quantity: 1,
    hasGlass: true,
    hasMatboard: true,
    matboardBorderCm: 0,
    frame: {
      id: "frame-4",
      faceMm: 0,
      referencePricePerMeter: 2.2875,
      referenceCostPerMeter: 2.2875,
    },
    glassCostPerSquareM: 33.333,
    matboardCostPerSquareM: 0.555,
  });

  assert.equal(result.frameCost, 1.01);
  assert.equal(result.glassCost, 0.33);
  assert.equal(result.matboardCost, 0.01);
  assert.equal(result.projectedCost, 1.35);
  assert.equal(result.preliminaryPrice, 1.35);
});

test("calculatePreliminaryPricing for bastidor simple uses lomo geometry", () => {
  const result = calculatePreliminaryPricing({
    widthCm: 50,
    heightCm: 60,
    quantity: 1,
    hasGlass: false,
    hasMatboard: false,
    assemblyMode: "bastidor",
    bastidor: {
      variant: "simple",
      lightCm: 1,
      supportMm: 10,
      lomoMm: 14,
      depthMm: 10,
    },
    frame: {
      id: "frame-5",
      faceMm: 24,
      referencePricePerMeter: 100,
      referenceCostPerMeter: 100,
    },
  });

  assert.equal(result.outerWidthCm, 54.8);
  assert.equal(result.outerHeightCm, 64.8);
  assert.equal(result.perimeterCm, 239.2);
  assert.equal(result.requiredMouldingCm, 263.12);
  assert.equal(result.requiredMouldingM, 2.63);
  assert.equal(result.areaM2, 0.36);
  assert.equal(result.frameCost, 263.12);
  assert.equal(result.projectedCost, 263.12);
  assert.equal(result.preliminaryPrice, 263.12);
});

test("calculatePreliminaryPricing for bastidor with matboard uses obra plus luz", () => {
  const result = calculatePreliminaryPricing({
    widthCm: 50,
    heightCm: 60,
    quantity: 1,
    hasGlass: true,
    hasMatboard: true,
    matboardBorderCm: 5,
    assemblyMode: "bastidor",
    bastidor: {
      variant: "simple",
      lightCm: 1,
      supportMm: 10,
      lomoMm: 14,
      depthMm: 10,
    },
    frame: {
      id: "frame-6",
      faceMm: 24,
      referencePricePerMeter: 200,
      referenceCostPerMeter: 200,
    },
    glassCostPerSquareM: 100,
    matboardCostPerSquareM: 50,
  });

  assert.equal(result.outerWidthCm, 64.8);
  assert.equal(result.outerHeightCm, 74.8);
  assert.equal(result.requiredMouldingCm, 307.12);
  assert.equal(result.requiredMouldingM, 3.07);
  assert.equal(result.areaM2, 0.48);
  assert.equal(result.frameCost, 614.24);
  assert.equal(result.glassCost, 48.47);
  assert.equal(result.matboardCost, 24.24);
  assert.equal(result.projectedCost, 686.95);
});

test("calculatePreliminaryPricing for bastidor double_profile sums both frame costs", () => {
  const result = calculatePreliminaryPricing({
    widthCm: 50,
    heightCm: 60,
    quantity: 1,
    hasGlass: false,
    hasMatboard: false,
    assemblyMode: "bastidor",
    bastidor: {
      variant: "double_profile",
      lightCm: 1,
      supportMm: 10,
      lomoMm: 14,
      depthMm: 24,
      secondaryFrameId: "frame-depth",
    },
    frame: {
      id: "frame-support",
      faceMm: 28,
      referencePricePerMeter: 100,
      referenceCostPerMeter: 100,
      secondaryFrame: {
        id: "frame-depth",
        referencePricePerMeter: 50,
        referenceCostPerMeter: 50,
      },
    },
  });

  assert.equal(result.requiredMouldingCm, 263.12);
  assert.equal(result.requiredMouldingM, 2.63);
  assert.equal(result.frameCost, 394.68);
  assert.equal(result.projectedCost, 394.68);
  assert.equal(result.preliminaryPrice, 394.68);
});
