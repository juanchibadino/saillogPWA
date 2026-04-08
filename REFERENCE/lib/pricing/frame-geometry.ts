import {
  MOULDING_WASTE_PERCENT,
  type AssemblyMode,
  type BastidorSnapshot,
} from "@/types/domain";

export type FrameGeometryInput = {
  widthCm: number;
  heightCm: number;
  quantity: number;
  hasMatboard?: boolean;
  matboardBorderCm?: number | null;
  frameFaceMm: number;
  assemblyMode?: AssemblyMode;
  bastidor?: BastidorSnapshot | null;
};

export type SimpleBastidorFrame = {
  id: string;
  faceMm: number;
  depthMm: number;
  lomoMm: number | null;
};

export type FrameGeometryResult = {
  assemblyMode: AssemblyMode;
  matboardBorderCm: number;
  lightCm: number;
  visibleFaceCm: number;
  supportMm: number;
  lomoMm: number;
  depthMm: number;
  outerWidthCm: number;
  outerHeightCm: number;
  perimeterCm: number;
  requiredMouldingCm: number;
  requiredMouldingM: number;
  areaM2: number;
  hasSupportMismatch: boolean;
};

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function calculatePerimeterCm(widthCm: number, heightCm: number): number {
  return (widthCm + heightCm) * 2;
}

export function hasBastidorSupportMismatch(lightCm: number, supportMm: number): boolean {
  return round1(lightCm * 10) !== round1(supportMm);
}

export function deriveSimpleBastidorSnapshot(
  frame: SimpleBastidorFrame,
  lightCm: number,
): BastidorSnapshot | null {
  if (frame.lomoMm === null || frame.lomoMm === undefined || frame.lomoMm <= 0) {
    return null;
  }

  return {
    variant: "simple",
    lightCm: Math.max(lightCm, 0),
    supportMm: Math.max(frame.faceMm - frame.lomoMm, 0),
    lomoMm: frame.lomoMm,
    depthMm: frame.depthMm,
  };
}

export function calculateFrameGeometry(input: FrameGeometryInput): FrameGeometryResult {
  const assemblyMode = input.assemblyMode ?? "normal";
  const matboardBorderCm =
    input.hasMatboard ? Math.max(input.matboardBorderCm ?? 0, 0) : 0;

  const faceMm = Math.max(input.frameFaceMm, 0);
  const lightCm = assemblyMode === "bastidor" ? Math.max(input.bastidor?.lightCm ?? 0, 0) : 0;
  const lomoMm =
    assemblyMode === "bastidor"
      ? Math.max(input.bastidor?.lomoMm ?? 0, 0)
      : faceMm;
  const supportMm =
    assemblyMode === "bastidor"
      ? Math.max(input.bastidor?.supportMm ?? 0, 0)
      : faceMm;
  const depthMm =
    assemblyMode === "bastidor"
      ? Math.max(input.bastidor?.depthMm ?? 0, 0)
      : 0;
  const visibleFaceCm = lomoMm / 10;
  const baseWidthCm = Math.max(input.widthCm, 0) + matboardBorderCm * 2 + lightCm * 2;
  const baseHeightCm = Math.max(input.heightCm, 0) + matboardBorderCm * 2 + lightCm * 2;
  const outerWidthCm = baseWidthCm + visibleFaceCm * 2;
  const outerHeightCm = baseHeightCm + visibleFaceCm * 2;
  const perimeterCm = calculatePerimeterCm(outerWidthCm, outerHeightCm);
  const requiredMouldingCm =
    perimeterCm * (1 + MOULDING_WASTE_PERCENT) * Math.max(input.quantity, 0);
  const requiredMouldingM = requiredMouldingCm / 100;
  const areaM2 =
    (outerWidthCm * outerHeightCm * Math.max(input.quantity, 0)) / 10000;

  return {
    assemblyMode,
    matboardBorderCm,
    lightCm,
    visibleFaceCm,
    supportMm,
    lomoMm,
    depthMm,
    outerWidthCm,
    outerHeightCm,
    perimeterCm,
    requiredMouldingCm,
    requiredMouldingM,
    areaM2,
    hasSupportMismatch:
      assemblyMode === "bastidor" && hasBastidorSupportMismatch(lightCm, supportMm),
  };
}
