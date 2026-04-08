import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFrameGeometry,
  deriveSimpleBastidorSnapshot,
  hasBastidorSupportMismatch,
} from "@/lib/pricing/frame-geometry";

function assertApprox(actual: number, expected: number, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

test("calculateFrameGeometry keeps normal moulding geometry", () => {
  const geometry = calculateFrameGeometry({
    widthCm: 40,
    heightCm: 30,
    quantity: 1,
    frameFaceMm: 20,
  });

  assert.equal(geometry.assemblyMode, "normal");
  assert.equal(geometry.outerWidthCm, 44);
  assert.equal(geometry.outerHeightCm, 34);
  assert.equal(geometry.perimeterCm, 156);
  assertApprox(geometry.requiredMouldingCm, 171.6);
  assertApprox(geometry.requiredMouldingM, 1.716);
  assertApprox(geometry.areaM2, 0.1496);
  assert.equal(geometry.hasSupportMismatch, false);
});

test("deriveSimpleBastidorSnapshot uses face minus lomo as real support", () => {
  const snapshot = deriveSimpleBastidorSnapshot(
    {
      id: "frame-1",
      faceMm: 24,
      depthMm: 10,
      lomoMm: 14,
    },
    1,
  );

  assert.deepEqual(snapshot, {
    variant: "simple",
    lightCm: 1,
    supportMm: 10,
    lomoMm: 14,
    depthMm: 10,
  });
});

test("calculateFrameGeometry for bastidor simple uses luz and lomo in the perimeter", () => {
  const geometry = calculateFrameGeometry({
    widthCm: 50,
    heightCm: 60,
    quantity: 1,
    frameFaceMm: 24,
    assemblyMode: "bastidor",
    bastidor: {
      variant: "simple",
      lightCm: 1,
      supportMm: 10,
      lomoMm: 14,
      depthMm: 10,
    },
  });

  assert.equal(geometry.outerWidthCm, 54.8);
  assert.equal(geometry.outerHeightCm, 64.8);
  assertApprox(geometry.perimeterCm, 239.2);
  assertApprox(geometry.requiredMouldingCm, 263.12);
  assertApprox(geometry.requiredMouldingM, 2.6312);
  assertApprox(geometry.areaM2, 0.355104);
  assert.equal(geometry.lomoMm, 14);
  assert.equal(geometry.supportMm, 10);
  assert.equal(geometry.hasSupportMismatch, false);
});

test("calculateFrameGeometry for bastidor includes matboard over obra plus luz", () => {
  const geometry = calculateFrameGeometry({
    widthCm: 50,
    heightCm: 60,
    quantity: 1,
    hasMatboard: true,
    matboardBorderCm: 5,
    frameFaceMm: 24,
    assemblyMode: "bastidor",
    bastidor: {
      variant: "simple",
      lightCm: 1,
      supportMm: 10,
      lomoMm: 14,
      depthMm: 10,
    },
  });

  assert.equal(geometry.outerWidthCm, 64.8);
  assert.equal(geometry.outerHeightCm, 74.8);
  assertApprox(geometry.perimeterCm, 279.2);
  assertApprox(geometry.requiredMouldingCm, 307.12);
  assertApprox(geometry.areaM2, 0.484704);
});

test("hasBastidorSupportMismatch compares rounded tenths", () => {
  assert.equal(hasBastidorSupportMismatch(1, 10.04), false);
  assert.equal(hasBastidorSupportMismatch(1, 9.9), true);
});
