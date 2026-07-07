import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import HubLayout from "@/components/HubLayout";
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
  title: "ToolNest Smart | Daily Productivity Tools",
  description: "A private, high-performance suite of daily utility tools. Includes background removal, photo resizing, print-ready PDF compilers, and more. Processed entirely locally on your device.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <HubLayout>
          {children}
        </HubLayout>
        <Analytics />
      </body>
    </html>
  );
}
