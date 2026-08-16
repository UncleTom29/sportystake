import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Settings & Welcome Bonus Manager — SportyStake",
  description:
    "Manage your non-custodial Web3 profile, activate your $2,000 Welcome Bonus match, track 10x accumulator rollover progress, and copy your referral link.",
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
