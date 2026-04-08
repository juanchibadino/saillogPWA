import { sum } from "@/lib/utils/math";

export function calculateLeadPreliminaryTotal(
  resolvedItems: Array<{ preliminaryPrice: number }>,
) {
  return sum(resolvedItems.map((item) => item.preliminaryPrice));
}
