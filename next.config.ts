import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.31.89", "192.168.31.89:3000", "http://192.168.31.89:3000"],
};

export default nextConfig;
