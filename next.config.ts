import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Configure external image domains if needed
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "cdn.stellarspend.app",
      },
    ],
    // Enable modern image formats
    formats: ["image/avif", "image/webp"],
    // Optimize for performance
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async redirects() {
    return [
      {
        source: '/dashboard/anaytics',
        destination: '/dashboard/analytics',
        permanent: true,
      },
    ];
  },
  turbopack: {
    resolveAlias: {
      '@aztec/bb.js': './lib/zk/mockWorkerThreads.ts',
      '@noir-lang/noir_js': './lib/zk/mockWorkerThreads.ts',
      '@noir-lang/acvm_js': './lib/zk/mockWorkerThreads.ts',
      '@noir-lang/noirc_abi': './lib/zk/mockWorkerThreads.ts',
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@aztec/bb.js': false,
        '@noir-lang/noir_js': false,
        '@noir-lang/acvm_js': false,
        '@noir-lang/noirc_abi': false,
      };
    }
    return config;
  },
};

export default nextConfig;
