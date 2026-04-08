import { REMNANT_REUSABLE_THRESHOLD_CM } from "@/types/domain";
import { round2 } from "@/lib/utils/math";

export type StockSegment = {
  id: string;
  remainingLengthCm: number;
};

export type AllocationMove = {
  sourceType: "remnant" | "lot";
  sourceId: string;
  consumedCm: number;
  newRemainingCm: number;
  reusable: boolean;
};

export type StockAllocationResult = {
  moves: AllocationMove[];
  consumedCm: number;
  shortageCm: number;
};

export function isReusableRemnant(remainingCm: number): boolean {
  return remainingCm > REMNANT_REUSABLE_THRESHOLD_CM;
}

function allocateFromSegments(
  sourceType: "remnant" | "lot",
  requiredCm: number,
  segments: StockSegment[],
): StockAllocationResult {
  const ordered = [...segments].sort(
    (a, b) => a.remainingLengthCm - b.remainingLengthCm,
  );

  let pending = requiredCm;
  const moves: AllocationMove[] = [];

  for (const segment of ordered) {
    if (pending <= 0) {
      break;
    }

    const consumed = Math.min(pending, segment.remainingLengthCm);
    const newRemaining = round2(segment.remainingLengthCm - consumed);

    moves.push({
      sourceType,
      sourceId: segment.id,
      consumedCm: round2(consumed),
      newRemainingCm: newRemaining,
      reusable: isReusableRemnant(newRemaining),
    });

    pending = round2(pending - consumed);
  }

  return {
    moves,
    consumedCm: round2(requiredCm - pending),
    shortageCm: round2(Math.max(pending, 0)),
  };
}

export function allocateStock(
  requiredCm: number,
  remnants: StockSegment[],
  lots: StockSegment[],
): StockAllocationResult {
  const fromRemnants = allocateFromSegments("remnant", requiredCm, remnants);

  if (fromRemnants.shortageCm <= 0) {
    return fromRemnants;
  }

  const fromLots = allocateFromSegments("lot", fromRemnants.shortageCm, lots);

  return {
    moves: [...fromRemnants.moves, ...fromLots.moves],
    consumedCm: round2(fromRemnants.consumedCm + fromLots.consumedCm),
    shortageCm: round2(fromLots.shortageCm),
  };
}
