import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Disable Next.js built-in gzip — it corrupts streaming proxy responses.
  // Render's load balancer handles compression at the edge.
  compress: false,
  experimental: {
    // Enables Server Actions (already stable in Next 15, keeping for clarity)
  },
};

export default nextConfig;
