import type { Metadata } from "next";
import { Onest, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// next/font self-hosts the files at build time, so the demo runs offline.
const onest = Onest({ subsets: ["latin"], variable: "--font-onest" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Invoice readiness",
  description: "From completed repair job to an invoice Finance can approve. Rules decide, AI reads, humans approve.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${onest.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
