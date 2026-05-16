"use client";
import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/walletStore";
import { ChevronLeft, CopyIcon, TrendUp, TrendDown, ZapIcon } from "@/components/icons/UIIcons";

type TxType = "deposit" | "withdrawal" | "bet" | "win" | "lp_deposit" | "lp_return";

const TX_LABELS: Record<TxType, string> = {
  deposit: "Deposit", withdrawal: "Withdrawal", bet: "Bet placed", win: "Winnings",
  lp_deposit: "LP Deposit", lp_return: "LP Return",
};

type Tx = { id: string; type: TxType; amount: number; status: "confirmed" | "pending"; date: string; txHash?: string };

const MOCK_TXS: Tx[] = [
  { id: "t1", type: "win",        amount: +160.00, status: "confirmed", date: "May 16 20:45", txHash: "0xabc…d1" },
  { id: "t2", type: "bet",        amount: -50.00,  status: "confirmed", date: "May 16 18:00", txHash: "0xabc…d2" },
  { id: "t3", type: "lp_return",  amount: +12.40,  status: "confirmed", date: "May 14 22:00", txHash: "0xabc…d3" },
  { id: "t4", type: "lp_deposit", amount: -500.00, status: "confirmed", date: "May 12 10:00", txHash: "0xabc…d4" },
  { id: "t5", type: "bet",        amount: -25.00,  status: "confirmed", date: "May 11 20:00", txHash: "0xabc…d5" },
  { id: "t6", type: "deposit",    amount: +1000.00, status: "confirmed", date: "May 10 09:00", txHash: "0xabc…d6" },
  { id: "t7", type: "win",        amount: +97.20,  status: "confirmed", date: "May 09 14:01", txHash: "0xabc…d7" },
  { id: "t8", type: "bet",        amount: -30.00,  status: "confirmed", date: "May 09 14:00", txHash: "0xabc…d8" },
];

const TYPE_ICON: Record<TxType, string> = {
  deposit: "⬇️", withdrawal: "⬆️", bet: "🎟", win: "🏆", lp_deposit: "💧", lp_return: "💰",
};

export default function WalletPage() {
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawTo, setWithdrawTo] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const address = useWallet((s) => s.address) ?? "0x4a...91bc";
  const balance = useWallet((s) => s.balanceUsdc);

  const copy = (text: string) => navigator.clipboard.writeText(text);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-[12px] text-[var(--color-ink-3)]">
        <Link href="/account" className="flex items-center gap-1 hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" />
          Account
        </Link>
        <span>/</span>
        <span className="text-white">Wallet</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Balance + deposit */}
        <div className="space-y-3">
          {/* Balance */}
          <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,231,1,0.07),transparent_55%)]" />
            <div className="relative">
              <p className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">Available balance</p>
              <p className="mono mt-2 text-4xl font-black text-white">{balance} <span className="text-[var(--color-ink-3)] text-2xl">USDC</span></p>
              <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">Arc Network · 6 decimals</p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => setShowWithdraw(true)}
                  className="flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-3 text-[13px] font-semibold text-white hover:bg-[var(--color-bg-3)]"
                >
                  Withdraw
                </button>
                <span className="text-[11px] text-[var(--color-ink-3)]">Instant on Arc</span>
              </div>
            </div>
          </div>

          {/* Deposit */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Deposit USDC</p>
            <p className="mb-4 text-[12px] text-[var(--color-ink-2)] leading-relaxed">
              Send USDC on the <strong>Arc network</strong> to your wallet address below. Funds appear instantly after 1 confirmation.
            </p>

            {/* QR placeholder */}
            <div className="mb-4 flex justify-center">
              <div className="flex h-40 w-40 items-center justify-center rounded-xl border-2 border-[var(--color-line-2)] bg-[var(--color-bg-1)] text-[var(--color-ink-3)]">
                <svg viewBox="0 0 100 100" className="h-24 w-24 opacity-40">
                  <rect x={10} y={10} width={35} height={35} rx={4} fill="none" stroke="currentColor" strokeWidth={6} />
                  <rect x={55} y={10} width={35} height={35} rx={4} fill="none" stroke="currentColor" strokeWidth={6} />
                  <rect x={10} y={55} width={35} height={35} rx={4} fill="none" stroke="currentColor" strokeWidth={6} />
                  <rect x={20} y={20} width={15} height={15} rx={2} fill="currentColor" />
                  <rect x={65} y={20} width={15} height={15} rx={2} fill="currentColor" />
                  <rect x={20} y={65} width={15} height={15} rx={2} fill="currentColor" />
                  <rect x={55} y={55} width={10} height={10} fill="currentColor" />
                  <rect x={70} y={55} width={10} height={10} fill="currentColor" />
                  <rect x={55} y={70} width={10} height={10} fill="currentColor" />
                  <rect x={80} y={80} width={10} height={10} fill="currentColor" />
                </svg>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-3 py-2.5">
              <span className="mono flex-1 truncate text-[12px] text-[var(--color-ink-1)]">{address}</span>
              <button onClick={() => copy(address)} className="shrink-0 text-[var(--color-ink-3)] hover:text-white">
                <CopyIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-[var(--color-ink-4)]">Only send USDC on Arc network. Other tokens lost.</p>
          </div>
        </div>

        {/* Transaction history */}
        <div className="space-y-3">
          {/* Withdraw panel */}
          {showWithdraw && (
            <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Withdraw</p>
                <button onClick={() => setShowWithdraw(false)} className="text-[var(--color-ink-3)] hover:text-white">✕</button>
              </div>
              <label className="mb-1 block text-[11px] text-[var(--color-ink-3)]">Amount (USDC)</label>
              <div className="flex h-11 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-3 focus-within:border-[var(--color-brand-500)]/40 mb-2">
                <span className="mono text-[var(--color-ink-3)]">$</span>
                <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00" className="mono ml-2 w-full bg-transparent text-[14px] font-bold text-white outline-none" />
                <button onClick={() => setWithdrawAmount("1247.50")} className="text-[11px] font-bold text-[var(--color-brand-500)]">Max</button>
              </div>
              <label className="mb-1 block text-[11px] text-[var(--color-ink-3)]">Destination address</label>
              <input type="text" value={withdrawTo} onChange={(e) => setWithdrawTo(e.target.value)}
                placeholder={address}
                className="mono mb-3 h-11 w-full rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-3 text-[13px] text-white outline-none focus:border-[var(--color-brand-500)]/40 placeholder:text-[var(--color-ink-4)]" />
              <button className="flex w-full h-10 items-center justify-center gap-1.5 rounded-md bg-[var(--color-brand-500)] text-[13px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]">
                <ZapIcon className="h-4 w-4" />
                Withdraw {withdrawAmount ? `${withdrawAmount} USDC` : ""}
              </button>
            </div>
          )}

          {/* TX history */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] overflow-hidden">
            <div className="border-b border-[var(--color-line-1)] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Transaction history</p>
            </div>
            <div className="divide-y divide-[var(--color-line-1)]">
              {MOCK_TXS.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-3)]">
                  <span className="text-xl">{TYPE_ICON[tx.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white">{TX_LABELS[tx.type]}</p>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--color-ink-3)]">
                      <span>{tx.date}</span>
                      {tx.txHash && (
                        <span className="mono text-[var(--color-info)]">{tx.txHash}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className="mono font-bold text-[14px]"
                      style={{ color: tx.amount >= 0 ? "var(--color-brand-500)" : "var(--color-live)" }}
                    >
                      {tx.amount >= 0 ? "+" : ""}{tx.amount.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-[var(--color-ink-3)]">USDC</p>
                  </div>
                  <div className={`h-2 w-2 rounded-full ${tx.status === "confirmed" ? "bg-[var(--color-brand-500)]" : "bg-[var(--color-warn)] animate-pulse"}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
