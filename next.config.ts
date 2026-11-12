import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ẩn nút tròn "N" (công cụ dev của Next.js) ở góc màn hình
  devIndicators: false,
  // Cho phép upload file scan hồ sơ tối đa 10MB qua server action
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
