import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sportsbook — Live Sports Odds & Betting",
  description:
    "Bet on Premier League, Champions League, NBA, UFC, Tennis, Esports and 40+ global sports on SportyStake. Fast USDC wagering, instant payouts, and competitive odds.",
  keywords: [
    "sportsbook",
    "sports betting",
    "live football odds",
    "nba betting",
    "premier league odds",
    "fast payouts",
  ],
};

export default function SportsbookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
