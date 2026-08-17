import type { NextConfig } from "next";

const pdfRendererTraceFiles = [
  "./node_modules/playwright/**/*",
  "./node_modules/playwright-core/**/*",
  "./node_modules/@sparticuz/chromium/**/*",
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/reports/*/pdf": pdfRendererTraceFiles,
    "/api/team-expenses/report/pdf": pdfRendererTraceFiles,
  },
  experimental: {
    serverActions: {
      // GPS CSV uploads are capped in the mutation/storage layer at 25 MiB.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
