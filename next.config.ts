import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // 배포 시 ESLint 에러 무시 (변수 미사용 등)
    ignoreDuringBuilds: true, 
  },
  typescript: {
    // 배포 시 타입 에러 무시 (any 타입 등)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;