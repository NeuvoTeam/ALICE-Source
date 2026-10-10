import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geist = Geist({
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "ALICE",
  description:
    "AI-powered tools for mental health clinicians",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media:
          "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media:
          "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
  className={`${geist.className} ${geistMono.variable} antialiased`}
>
  {children}
  <Toaster />
</body>
    </html>
  );
}