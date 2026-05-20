import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Clerk proxy.ts buffers request bodies; raise limit for KB file uploads (API allows ~50MB).
    proxyClientMaxBodySize: "52mb",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.clerk.accounts.dev" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
};

export default nextConfig;
