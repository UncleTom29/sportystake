import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Decentralized Sportsbook — Live Sports Odds & Betting",
  description:
    "Bet on Premier League, Champions League, NBA, UFC, Tennis, Esports and 40+ global sports on SportyStake. Non-custodial USDC wagering, instant on-chain payouts, zero KYC.",
  keywords: [
    "crypto sportsbook",
    "web3 sports betting",
    "live football odds",
    "nba betting crypto",
    "non-custodial sportsbook",
    "on-chain sports bets",
  ],
};

export default function SportsbookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
