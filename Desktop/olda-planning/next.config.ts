import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "out",
  assetPrefix: "./",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
