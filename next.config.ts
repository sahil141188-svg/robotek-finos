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
  // pdf-parse uses Node.js internals — must not be bundled for the browser
  serverExternalPackages: ["pdf-parse"],
  // Turbopack is the default in Next.js 16; PWA plugin injects a webpack config
  // so we must declare an explicit (empty) turbopack section to silence the error.
  turbopack: {},
};

export default withPWA(nextConfig);
