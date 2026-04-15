import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Enables Server Actions (already stable in Next 15, keeping for clarity)
  },
  // Allow images from any origin for verse text (no external images needed)
};

export default nextConfig;
