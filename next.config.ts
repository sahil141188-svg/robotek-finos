import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse uses Node.js internals — must not be bundled for the browser
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
