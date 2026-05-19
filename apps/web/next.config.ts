import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@dc-copilot/ui"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.clerk.accounts.dev" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
};

export default nextConfig;
