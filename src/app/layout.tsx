import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";
import BetSlip from "@/components/layout/BetSlip";

export const metadata: Metadata = {
  title: "SportyStake — Non-Custodial Crypto Sportsbook",
  description:
    "Bet on sports, play casino games, and earn yield — all with your crypto wallet. The next-generation decentralized sportsbook on Arc.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#0a1520] text-white antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <BetSlip />
      </body>
    </html>
  );
}
