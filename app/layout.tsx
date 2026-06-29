import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Robotek FinOS",
    default:  "Robotek FinOS",
  },
  description: "Integrated Finance and Compliance Operating System for Robotek Group",
  manifest: "/manifest.webmanifest",

  // iOS "Add to Home Screen" support
  appleWebApp: {
    capable:        true,
    statusBarStyle: "black-translucent",
    title:          "FinOS",
  },

  icons: {
    icon:  [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

/** Viewport export — themeColor here avoids Next.js deprecation warning */
export const viewport: Viewport = {
  themeColor:   "#E52D31",
  width:        "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  viewportFit:  "cover",   // respects iPhone notch / Dynamic Island safe area
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
