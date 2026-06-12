import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "twenty-islands-smile.loca.lt",
    "*.loca.lt"
  ]
};

export default nextConfig;
