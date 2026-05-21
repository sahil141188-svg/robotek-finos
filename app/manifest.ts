import type { MetadataRoute } from "next";

/**
 * Web App Manifest — enables PWA installation on Android and iOS.
 * Defines app name, icons, theme colour, and display mode.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "Robotek FinOS",
    short_name:       "FinOS",
    description:      "Integrated Finance & Compliance OS for Robotek Group",
    start_url:        "/dashboard",
    display:          "standalone",
    orientation:      "portrait",
    background_color: "#FEFEFE",
    theme_color:      "#E52D31",
    categories:       ["finance", "business", "productivity"],
    icons: [
      {
        src:     "/icon-192.svg",
        sizes:   "192x192",
        type:    "image/svg+xml",
        purpose: "any",
      },
      {
        src:     "/icon-512.svg",
        sizes:   "512x512",
        type:    "image/svg+xml",
        purpose: "maskable",
      },
      {
        src:     "/apple-touch-icon.svg",
        sizes:   "180x180",
        type:    "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name:      "Dashboard",
        url:       "/dashboard",
        icons: [{ src: "/icon-192.svg", sizes: "192x192" }],
      },
      {
        name:      "Alerts",
        url:       "/dashboard/alerts",
        icons: [{ src: "/icon-192.svg", sizes: "192x192" }],
      },
      {
        name:      "Tasks",
        url:       "/dashboard/tasks",
        icons: [{ src: "/icon-192.svg", sizes: "192x192" }],
      },
      {
        name:      "Bank Statements",
        url:       "/dashboard/banking",
        icons: [{ src: "/icon-192.svg", sizes: "192x192" }],
      },
    ],
  };
}
