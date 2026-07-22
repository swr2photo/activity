import type { NextConfig } from "next";
import path from "path";

/** relative — Turbopack on Windows ยังไม่รองรับ absolute path */
const lucideEpBridgeRel = "./src/components/icons/lucide-ep-bridge.tsx";
const lucideEpBridgeAbs = path.resolve(process.cwd(), "src/components/icons/lucide-ep-bridge.tsx");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  turbopack: {
    resolveAlias: {
      "lucide-react": lucideEpBridgeRel,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "lucide-react": lucideEpBridgeAbs,
    };
    return config;
  },
};

export default nextConfig;
