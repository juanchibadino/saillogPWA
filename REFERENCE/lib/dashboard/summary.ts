import { round2 } from "@/lib/utils/math";

export type DashboardJob = {
  id: string;
  status: string;
  projectedRevenue: number;
  projectedTotalCost: number;
  projectedMargin: number;
  actualTotalCost: number | null;
  actualMargin: number | null;
  createdAt: string;
};

export function buildDashboardSummary(jobs: DashboardJob[]) {
  const totals = jobs.reduce(
    (acc, job) => {
      acc.projectedRevenue += job.projectedRevenue;
      acc.projectedCost += job.projectedTotalCost;
      acc.projectedMargin += job.projectedMargin;
      acc.actualCost += job.actualTotalCost ?? 0;
      acc.actualMargin += job.actualMargin ?? 0;
      return acc;
    },
    {
      projectedRevenue: 0,
      projectedCost: 0,
      projectedMargin: 0,
      actualCost: 0,
      actualMargin: 0,
    },
  );

  return {
    totals: {
      projectedRevenue: round2(totals.projectedRevenue),
      projectedCost: round2(totals.projectedCost),
      projectedMargin: round2(totals.projectedMargin),
      actualCost: round2(totals.actualCost),
      actualMargin: round2(totals.actualMargin),
    },
    jobs: jobs.map((job) => ({
      ...job,
      marginDeviation:
        job.actualMargin === null
          ? null
          : round2(job.actualMargin - job.projectedMargin),
    })),
  };
}
