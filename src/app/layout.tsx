import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stellar Crowdfund | Decentralized Fundraising",
  description:
    "A decentralized crowdfunding platform built on Stellar with Soroban smart contracts. Yellow Belt submission for Stellar Journey to Mastery.",
  keywords: ["Stellar", "Soroban", "crowdfunding", "blockchain", "DeFi"],
  openGraph: {
    title: "Stellar Crowdfund",
    description: "Decentralized fundraising on Stellar testnet",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${spaceMono.variable} ${playfair.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
