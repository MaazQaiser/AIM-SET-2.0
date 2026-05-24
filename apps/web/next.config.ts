import path from "node:path";
import type { NextConfig } from "next";
import { assertVercelBuildEnv } from "./src/lib/public-env";

const repoRoot = path.resolve(process.cwd(), "../..");

if (process.env.VERCEL === "1") {
  assertVercelBuildEnv();
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["@dc-copilot/ui"],
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
