import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["recharts", "d3", "lucide-react"],
  },
};

export default nextConfig;
