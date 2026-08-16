import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Be The House — Protocol Liquidity Pools & APY Yield",
  description:
    "Deposit USDC into SportyStake's single shared protocol liquidity pool. Bank the house and earn up to 22,000% APY derived from real platform house margin. Non-custodial & permissionless.",
  keywords: [
    "be the house crypto",
    "liquidity pool yield",
    "crypto house APY",
    "usdc staking pool",
    "decentralized casino bankroll",
  ],
};

export default function PoolsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
