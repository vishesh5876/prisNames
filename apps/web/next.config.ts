import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Proxy browser /api/v1/* requests to the NestJS backend (same-origin). */
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_INTERNAL_URL || 'http://localhost:4000'}/api/v1/:path*`,
      },
    ];
  },
  /** Transpile workspace packages for Tailwind/CSS processing. */
  transpilePackages: ['@prisnames/ui', '@prisnames/config', '@prisnames/contracts'],
};

export default nextConfig;
