import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest:            "public",   // service worker + workbox files go here
  cacheOnFrontEndNav: true,   // cache pages navigated to on the client
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline:  true,
  disable:         process.env.NODE_ENV === "development", // skip SW in dev
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  // pdf-parse and its underlying engine (pdfjs-dist) must run on Node.js only.
  // Listed here so neither package is bundled for the browser by Turbopack.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // Turbopack is the default in Next.js 16; PWA plugin injects a webpack config
  // so we must declare an explicit (empty) turbopack section to silence the error.
  turbopack: {},
  // Raise server action body size limit so large PDFs (up to 100 MB) can be
  // uploaded without Next.js rejecting the multipart request at the framework level.
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  // Clean URL for the public customer stock microsite served from public/stock/.
  async rewrites() {
    return [
      { source: "/stock", destination: "/stock/index.html" },
      { source: "/stock/", destination: "/stock/index.html" },
    ];
  },
};

export default withPWA(nextConfig);
