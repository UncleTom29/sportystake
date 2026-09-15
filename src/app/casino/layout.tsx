import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provably Fair Casino — Crash, Dice, Slots, Table Games",
  description:
    "Play provably fair Aviator crash game, Dice, Slots, European Roulette, and Blackjack on SportyStake. Transparent odds, instant payouts, and premium gaming.",
  keywords: [
    "casino",
    "provably fair casino",
    "aviator crash",
    "dice game",
    "slots",
    "blackjack",
    "roulette",
  ],
};

export default function CasinoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
