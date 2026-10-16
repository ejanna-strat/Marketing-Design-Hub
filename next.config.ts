import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Load only the UI pieces each page uses from these packages.
    optimizePackageImports: ["radix-ui"],
  },
};

export default nextConfig;
