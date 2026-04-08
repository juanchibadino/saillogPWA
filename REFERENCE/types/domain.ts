import type { ColorGroup, StyleType } from "@/lib/catalog/taxonomy";

export const LEAD_STATUSES = [
  "lead_new",
  "quote_reviewed",
  "quote_sent_final",
  "quote_approved",
  "quote_rejected",
] as const;

export const QUOTE_STATUSES = [
  "quote_reviewed",
  "quote_sent_final",
  "quote_approved",
  "quote_rejected",
] as const;

export const JOB_STATUSES = [
  "job_created",
  "materials_check",
  "purchase_pending",
  "ready_for_production",
  "in_framing",
  "in_painting",
  "in_packaging",
  "finished",
  "delivered",
] as const;

export const DEFAULT_JOB_STAGES = [
  "materials_check",
  "in_framing",
  "in_painting",
  "in_packaging",
  "finished",
] as const;

export const REMNANT_REUSABLE_THRESHOLD_CM = 40;
export const MOULDING_WASTE_PERCENT = 0.1;
export const ASSEMBLY_MODES = ["normal", "bastidor"] as const;
export const BASTIDOR_VARIANTS = ["simple", "double_profile"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type AssemblyMode = (typeof ASSEMBLY_MODES)[number];
export type BastidorVariant = (typeof BASTIDOR_VARIANTS)[number];

export type MatchingInput = {
  woodType: string;
  styleType: StyleType;
  colorGroup: ColorGroup;
  faceMm: number;
  depthMm: number;
};

export type MatchedProfile = {
  id: string;
  woodType: string;
  styleType: StyleType;
  colorGroup: ColorGroup;
  faceMm: number;
  depthMm: number;
  referencePricePerMeter: number;
  referenceCostPerMeter: number;
  publicLabel: string | null;
  supportsBastidor: boolean;
  lomoMm: number | null;
};

export type BastidorSnapshot = {
  variant: BastidorVariant;
  lightCm: number;
  supportMm: number;
  lomoMm: number;
  depthMm: number;
  secondaryFrameId?: string | null;
};

export type PricingInput = {
  // Width/height are the sheet/artwork size in cm.
  widthCm: number;
  heightCm: number;
  quantity: number;
  hasGlass: boolean;
  hasMatboard: boolean;
  matboardBorderCm?: number;
  assemblyMode?: AssemblyMode;
  bastidor?: BastidorSnapshot | null;
  frame: {
    id: string;
    faceMm: number;
    referencePricePerMeter: number;
    referenceCostPerMeter: number;
    secondaryFrame?: {
      id: string;
      referencePricePerMeter: number;
      referenceCostPerMeter: number;
    } | null;
  };
  // Accessory costs are in currency per square meter.
  glassCostPerSquareM?: number;
  matboardCostPerSquareM?: number;
};

export type PricingResult = {
  outerWidthCm: number;
  outerHeightCm: number;
  perimeterCm: number;
  requiredMouldingCm: number;
  requiredMouldingM: number;
  areaM2: number;
  frameCost: number;
  framePrice: number;
  glassCost: number;
  matboardCost: number;
  laborCost: number;
  projectedCost: number;
  preliminaryPrice: number;
  projectedMargin: number;
};

export type ConfigurablePublicOption = {
  id: string;
  label: string;
  sort: number;
};
