import path from "node:path";
import type { NextConfig } from "next";

const repoRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  experimental: {
    // Clerk proxy.ts buffers request bodies; raise limit for KB file uploads (API allows ~50MB).
    proxyClientMaxBodySize: "52mb",
  },
  turbopack: {
    root: repoRoot,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.clerk.accounts.dev" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
};

export default nextConfig;
