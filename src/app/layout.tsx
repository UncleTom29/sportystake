import type { Metadata, Viewport } from "next";
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
  title: "SportyStake — Non-Custodial Crypto Sportsbook & Casino",
  description:
    "Bet on 40+ sports, play 200+ casino games, and earn yield from liquidity pools. Non-custodial, on-chain, instant settlement. Built on Arc.",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#0b141b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-[var(--color-bg-0)] text-white antialiased">
        <IntegrationProvider />
        <QuotaStatusBanner />
        <Header />
        <SportsNav />
        <div className="relative">
          <main className="pb-24 md:pb-16 lg:pr-[360px]">{children}</main>
          <BetSlipRail />
        </div>
        <Footer />
        <MobileBottomNav />
        <ToastTray />
      </body>
    </html>
  );
}
