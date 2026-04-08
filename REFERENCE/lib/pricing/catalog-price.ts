import { round2 } from "@/lib/utils/math";

const DEFAULT_PRELIMINARY_PRICE_FACTOR = 1.8;

export function getCatalogPreliminaryPriceFactor(): number {
  const raw = process.env.CATALOG_PRELIMINARY_PRICE_FACTOR;

  if (!raw) {
    return DEFAULT_PRELIMINARY_PRICE_FACTOR;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PRELIMINARY_PRICE_FACTOR;
  }

  return parsed;
}

export function deriveReferencePricePerMeter(costPerMeter: number): number {
  return round2(costPerMeter * getCatalogPreliminaryPriceFactor());
}
