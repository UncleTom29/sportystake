import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Social Sportsbook Feed & Shared Ticket Copy Betting",
  description:
    "Discover top tipster bet tickets, copy winning multi-bets, and earn affiliate commissions by sharing your tickets on X and Telegram.",
  keywords: [
    "social sports betting",
    "copy bet slip crypto",
    "affiliate bet ticket commission",
    "tipster leaderboard",
  ],
};

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
