import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // AVIF/WebP เล็กกว่า JPEG/PNG 30–50% สำหรับแบนเนอร์กิจกรรม
    formats: ["image/avif", "image/webp"],
    // แบนเนอร์เปลี่ยน URL เมื่ออัปโหลดใหม่ จึง cache ผลลัพธ์ที่ optimize แล้วได้นาน
    minimumCacheTTL: 60 * 60 * 24,
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
  compiler: {
    // ตัด console.log/debug ออกจาก bundle production (คง error/warn ไว้ดีบักได้)
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    // tree-shake import จาก barrel ของไลบรารี UI ให้เหลือเฉพาะที่ใช้จริง
    optimizePackageImports: ["lucide-react", "dayjs"],
  },
  // รวมไฟล์ข้อมูลโรงเรียนไทยใน standalone/serverless bundle แน่นอน
  outputFileTracingIncludes: {
    "/api/institutions/search": ["./src/data/thaiSchools.json"],
  },
};

export default nextConfig;
