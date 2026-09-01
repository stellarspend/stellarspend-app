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
  turbopack: {
    resolveAlias: {
      '@aztec/bb.js': './lib/zk/mockWorkerThreads.ts',
      '@noir-lang/noir_js': './lib/zk/mockWorkerThreads.ts',
      '@noir-lang/acvm_js': './lib/zk/mockWorkerThreads.ts',
      '@noir-lang/noirc_abi': './lib/zk/mockWorkerThreads.ts',
      // @ledgerhq/logs 6.18.0 declares an `import` condition pointing at
      // lib-es/ which is not shipped, so bundlers must use the CJS build.
      '@ledgerhq/logs': './node_modules/@ledgerhq/logs/lib/index.js',
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
        '@ledgerhq/logs': require.resolve('@ledgerhq/logs'),
      };
    }
    return config;
  },
};

export default nextConfig;
