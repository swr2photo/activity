import type { NextConfig } from "next";

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
  // รวมไฟล์ข้อมูลโรงเรียนไทยใน standalone/serverless bundle แน่นอน
  outputFileTracingIncludes: {
    "/api/institutions/search": ["./src/data/thaiSchools.json"],
  },
};

export default nextConfig;
