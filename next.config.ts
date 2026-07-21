import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // GPS CSV uploads are capped in the mutation/storage layer at 25 MiB.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
