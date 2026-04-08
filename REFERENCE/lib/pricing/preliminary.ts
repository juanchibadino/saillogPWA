import {
  type PricingInput,
  type PricingResult,
} from "@/types/domain";
import {
  calculateFrameGeometry,
} from "@/lib/pricing/frame-geometry";
import { round2 } from "@/lib/utils/math";

export function calculateOuterDimensionsCm(
  baseWidthCm: number,
  baseHeightCm: number,
  frameFaceMm: number,
) {
  const faceCm = Math.max(frameFaceMm, 0) / 10;

  return {
    outerWidthCm: baseWidthCm + faceCm * 2,
    outerHeightCm: baseHeightCm + faceCm * 2,
  };
}

export function calculateRequiredMouldingCm(
  baseWidthCm: number,
  baseHeightCm: number,
  quantity: number,
  frameFaceMm: number,
): number {
  return calculateFrameGeometry({
    widthCm: baseWidthCm,
    heightCm: baseHeightCm,
    quantity,
    frameFaceMm,
  }).requiredMouldingCm;
}

function calculateAreaM2(widthCm: number, heightCm: number, quantity: number): number {
  return (widthCm * heightCm * quantity) / 10000;
}

export function calculatePreliminaryPricing(input: PricingInput): PricingResult {
  const geometry = calculateFrameGeometry({
    widthCm: input.widthCm,
    heightCm: input.heightCm,
    quantity: input.quantity,
    hasMatboard: input.hasMatboard,
    matboardBorderCm: input.hasMatboard ? input.matboardBorderCm : undefined,
    frameFaceMm: input.frame.faceMm,
    assemblyMode: input.assemblyMode,
    bastidor: input.bastidor ?? null,
  });
  const outerWidthCm = geometry.outerWidthCm;
  const outerHeightCm = geometry.outerHeightCm;
  const perimeterCm = geometry.perimeterCm;
  const requiredMouldingCm = geometry.requiredMouldingCm;
  const requiredMouldingM = geometry.requiredMouldingM;

  const secondaryFrameCost =
    input.assemblyMode === "bastidor" && input.bastidor?.variant === "double_profile"
      ? requiredMouldingM * (input.frame.secondaryFrame?.referenceCostPerMeter ?? 0)
      : 0;
  const frameCost =
    requiredMouldingM * input.frame.referenceCostPerMeter + secondaryFrameCost;
  const framePrice = frameCost;

  const areaM2 = calculateAreaM2(outerWidthCm, outerHeightCm, input.quantity);
  const glassCost = input.hasGlass
    ? areaM2 * (input.glassCostPerSquareM ?? 0)
    : 0;
  const matboardCost = input.hasMatboard
    ? areaM2 * (input.matboardCostPerSquareM ?? 0)
    : 0;

  const laborCost = 0;

  const projectedCost = round2(frameCost + glassCost + matboardCost + laborCost);
  const preliminaryPrice = projectedCost;

  return {
    outerWidthCm: round2(outerWidthCm),
    outerHeightCm: round2(outerHeightCm),
    perimeterCm: round2(perimeterCm),
    requiredMouldingCm: round2(requiredMouldingCm),
    requiredMouldingM: round2(requiredMouldingM),
    areaM2: round2(areaM2),
    frameCost: round2(frameCost),
    framePrice: round2(framePrice),
    glassCost: round2(glassCost),
    matboardCost: round2(matboardCost),
    laborCost: round2(laborCost),
    projectedCost,
    preliminaryPrice,
    projectedMargin: round2(preliminaryPrice - projectedCost),
  };
}
