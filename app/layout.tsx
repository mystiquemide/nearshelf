import type { Metadata, Viewport } from "next";
import { DM_Mono, Inter, Newsreader } from "next/font/google";
import "./globals.css";
import type { ReactNode } from "react";

const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-serif", weight: ["500"], display: "swap" });
const mono = DM_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(host ? `https://${host}` : "http://localhost:3000"),
  title: "Nearshelf",
  description: "Recent, mid-list comp titles backed by real reader data.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
