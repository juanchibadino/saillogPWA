import { round2, sum } from "@/lib/utils/math";
import { areAllJobStagesDone } from "@/lib/jobs/stages";

export const JOB_LABOR_RATE_PER_HOUR = 42300;

export type JobCloseStage = {
  status: string;
  actualMinutes: number | null;
};

export type JobCloseMaterial = {
  consumed: boolean;
  actualCost: number;
  jobItemId: string;
};

export type JobCloseValidation = {
  canClose: boolean;
  blockers: string[];
  allStagesDone: boolean;
  allMaterialsUsed: boolean;
};

export type JobCloseTotals = {
  actualMaterialCost: number;
  actualLaborCost: number;
  actualTotalCost: number;
  actualMargin: number;
  totalActualMinutes: number;
  itemActualCosts: Array<{
    jobItemId: string;
    materialCost: number;
    laborCost: number;
  }>;
};

export function validateJobForClosure(
  stages: JobCloseStage[],
  materials: JobCloseMaterial[],
): JobCloseValidation {
  const allStagesDone = areAllJobStagesDone(stages);
  const allMaterialsUsed = materials.every((material) => material.consumed);
  const blockers: string[] = [];

  if (!allStagesDone) {
    blockers.push("Every stage must be marked as done.");
  }

  if (!allMaterialsUsed) {
    blockers.push("Every required material row must be used before closing the job.");
  }

  return {
    canClose: blockers.length === 0,
    blockers,
    allStagesDone,
    allMaterialsUsed,
  };
}

export function calculateActualLaborCost(
  totalActualMinutes: number,
  ratePerHour = JOB_LABOR_RATE_PER_HOUR,
) {
  return round2((Math.max(totalActualMinutes, 0) / 60) * ratePerHour);
}

export function buildJobCloseTotals(input: {
  projectedRevenue: number;
  stages: JobCloseStage[];
  materials: JobCloseMaterial[];
  ratePerHour?: number;
}): JobCloseTotals {
  const validation = validateJobForClosure(input.stages, input.materials);

  if (!validation.canClose) {
    throw new Error(validation.blockers.join(" "));
  }

  const materialCostByJobItem = new Map<string, number>();

  for (const material of input.materials) {
    materialCostByJobItem.set(
      material.jobItemId,
      round2((materialCostByJobItem.get(material.jobItemId) ?? 0) + material.actualCost),
    );
  }

  const totalActualMinutes = sum(
    input.stages.map((stage) => stage.actualMinutes ?? 0),
  );
  const actualMaterialCost = round2(
    sum(input.materials.map((material) => material.actualCost)),
  );
  const actualLaborCost = calculateActualLaborCost(
    totalActualMinutes,
    input.ratePerHour,
  );
  const actualTotalCost = round2(actualMaterialCost + actualLaborCost);
  const actualMargin = round2(input.projectedRevenue - actualTotalCost);

  return {
    actualMaterialCost,
    actualLaborCost,
    actualTotalCost,
    actualMargin,
    totalActualMinutes,
    itemActualCosts: Array.from(materialCostByJobItem.entries()).map(
      ([jobItemId, materialCost]) => ({
        jobItemId,
        materialCost,
        laborCost: 0,
      }),
    ),
  };
}
