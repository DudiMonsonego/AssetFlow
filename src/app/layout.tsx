import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "AssetFlow",
    template: "%s | AssetFlow",
  },
  description: "Professional Hardware Lifecycle Management for modern B2B teams.",
  // Prevent browsers (Chrome, Edge) from auto-translating the UI.
  // The app is intentionally English-only.
  other: {
    "google": "notranslate",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
