import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "twenty-islands-smile.loca.lt",
    "*.loca.lt"
  ],
  serverExternalPackages: ["playwright-core"],
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/playwright-core/browsers.json",
      "./node_modules/playwright-core/**/*",
    ],
  },
};

export default nextConfig;
