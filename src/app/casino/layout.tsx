import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provably Fair On-Chain Casino — Crash, Dice, Slots, Table Games",
  description:
    "Play provably fair Aviator crash game, Dice, Slots, European Roulette, and Blackjack on SportyStake. Cryptographic SHA-256 seed hashing, 0% house manipulation, instant non-custodial payouts.",
  keywords: [
    "crypto casino",
    "provably fair casino",
    "on-chain aviator crash",
    "sha-256 dice game",
    "decentralized slots",
    "non-custodial casino",
  ],
};

export default function CasinoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
