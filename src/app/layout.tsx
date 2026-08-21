import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import SportsNav from "@/components/layout/SportsNav";
import BetSlipRail from "@/components/layout/BetSlipRail";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import Footer from "@/components/layout/Footer";
import IntegrationProvider from "@/components/integration/IntegrationProvider";
import ToastTray from "@/components/integration/ToastTray";
import QuotaStatusBanner from "@/components/integration/QuotaStatusBanner";
import LiveScoreTicker from "@/components/layout/LiveScoreTicker";
import BetSlipInitializer from "@/components/integration/BetSlipInitializer";
import { Web3Provider } from "@/components/integration/Web3Provider";
import ComplianceModal from "@/components/integration/ComplianceModal";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sportystake.com"),
  title: {
    default: "SportyStake — Non-Custodial Crypto Sportsbook & On-Chain Casino",
    template: "%s | SportyStake",
  },
  description:
    "SportyStake is a fully non-custodial decentralized crypto sportsbook, provably fair casino, and quantitative prediction market. Bet on 40+ sports, deploy autonomous AI betting agents, and access verified +EV match signals. Instant sub-second settlement on Arc Network.",
  keywords: [
    "crypto sportsbook",
    "non-custodial betting",
    "on-chain casino",
    "decentralized sports betting",
    "Arc network",
    "free LLM sports analytics",
    "Claude Fable AI match predictions",
    "USDC sportsbook",
    "provably fair casino",
    "web3 sportsbook",
    "1xbet wager bonus match",
    "no kyc betting platform",
  ],
  authors: [{ name: "SportyStake Protocol" }],
  creator: "SportyStake",
  publisher: "SportyStake Protocol",
  alternates: {
    canonical: "https://sportystake.com",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sportystake.com",
    siteName: "SportyStake",
    title: "SportyStake — Non-Custodial Crypto Sportsbook & On-Chain Casino",
    description:
      "Bet on 40+ sports, play provably fair games, and earn yield as the house. Free LLM sports analytics, non-custodial settlement, zero KYC.",
    // images intentionally omitted — src/app/opengraph-image.tsx generates
    // and wires it automatically. The previous manual reference pointed at
    // /og-banner.jpg, a file that was never actually added to public/, so
    // every shared link rendered no preview image at all.
  },
  twitter: {
    card: "summary_large_image",
    title: "SportyStake — Non-Custodial Crypto Sportsbook & On-Chain Casino",
    description:
      "Bet on 40+ sports, play provably fair games, and earn yield as the house. Free LLM sports analytics, non-custodial settlement, zero KYC.",
    creator: "@sportystake",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b141b",
  width: "device-width",
  initialScale: 1,
};

const jsonLdSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://sportystake.com/#website",
      "url": "https://sportystake.com",
      "name": "SportyStake",
      "description": "Non-custodial crypto sportsbook, provably fair casino, and free LLM sports analytics.",
      "publisher": {
        "@type": "Organization",
        "name": "SportyStake Protocol",
        "url": "https://sportystake.com"
      }
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://sportystake.com/#application",
      "name": "SportyStake Protocol",
      "applicationCategory": "EntertainmentApplication",
      "operatingSystem": "Web, Arc EVM Blockchain",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
      </head>
      <body className="min-h-screen bg-bg-0 text-white antialiased">
        <Web3Provider>
          <ComplianceModal />
          <BetSlipInitializer />
          <IntegrationProvider />
          <QuotaStatusBanner />
          <Header />
          <Suspense fallback={<div className="sticky top-14 z-40 h-[45px] border-b border-[var(--color-line-1)] bg-[var(--color-bg-1)]/95" />}>
            <SportsNav />
          </Suspense>
          <LiveScoreTicker />
          <div className="relative">
            <main className="pb-24 md:pb-16 lg:pr-90">{children}</main>
            <BetSlipRail />
          </div>
          <Footer />
          <MobileBottomNav />
          <ToastTray />
        </Web3Provider>
      </body>
    </html>
  );
}
