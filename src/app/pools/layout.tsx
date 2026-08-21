import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Protocol Vaults — SportyStake",
  description: "SportyStake on-chain smart contract settlement and protocol solvency vaults.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PoolsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
