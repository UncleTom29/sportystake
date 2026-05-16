"use client";
import { useState } from "react";
import { liquidityPools } from "@/lib/mockData";
import { formatUsd } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  ShieldIcon,
  ZapIcon,
  TrendUp,
  SparkleIcon,
  UsdtIcon,
  UsdcIcon,
  EthIcon,
  CopyIcon,
} from "@/components/icons/UIIcons";

const tokenIcon = {
  USDT: UsdtIcon,
  USDC: UsdcIcon,
  ETH: EthIcon,
};

export default function PoolsPage() {
  const [active, setActive] = useState<string | null>(null);
  const [stake, setStake] = useState("");
  const totalTVL = liquidityPools.reduce((s, p) => s + p.tvl, 0);
  const avg = liquidityPools.reduce((s, p) => s + p.apy, 0) / liquidityPools.length;

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
        <div className="bg-mesh absolute inset-0" />
        <div className="relative grid items-center gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div>
            <Badge variant="brand">Earn · ERC-4626 vaults</Badge>
            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
              Bank the house.
              <span className="block text-[var(--color-brand-500)]">Earn the margin.</span>
            </h1>
            <p className="mt-3 max-w-xl text-[13px] text-[var(--color-ink-2)] md:text-sm">
              Deposit stablecoins or ETH into SportyStake&apos;s on-chain liquidity vaults. Earn a
              proportional share of every settled bet and every spin — denominated in real
              gameplay margin, not inflationary emissions.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Button>Provide liquidity</Button>
              <Button variant="outline">Read whitepaper</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric label="Total value locked" value={formatUsd(totalTVL)} accent="var(--color-brand-500)" />
            <Metric label="Average APY" value={`${avg.toFixed(1)}%`} accent="var(--color-info)" />
            <Metric label="LPs active" value="1,284" accent="#a78bfa" />
            <Metric label="Paid (30d)" value="$48,200" accent="var(--color-warn)" />
          </div>
        </div>
      </div>

      {/* My position */}
      <div className="mt-5 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
        <div className="flex items-center justify-between border-b border-[var(--color-line-1)] px-5 py-3">
          <div className="flex items-center gap-2">
            <SparkleIcon className="h-4 w-4 text-[var(--color-brand-500)]" />
            <p className="text-[13px] font-bold uppercase tracking-wider text-white">My position</p>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-[var(--color-bg-3)] px-2 py-1 text-[11px] text-[var(--color-ink-2)]">
            0x4a…91bc
            <CopyIcon className="h-3 w-3" />
          </div>
        </div>
        <div className="grid items-center gap-4 p-5 md:grid-cols-4">
          <Position label="Total staked" value="$5,000.00" sub="across 1 pool" />
          <Position label="Earnings (7d)" value="+$62.30" sub="auto-compounding" accent="var(--color-brand-500)" />
          <Position label="Current APY" value="12.4%" sub="floating · per-block" accent="var(--color-info)" />
          <div className="flex items-center gap-2 md:justify-end">
            <Button variant="outline" size="sm">Compound</Button>
            <Button variant="secondary" size="sm">Withdraw</Button>
          </div>
        </div>
      </div>

      {/* Pools list */}
      <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-wider text-[var(--color-ink-4)]">
        Available vaults
      </h2>
      <div className="space-y-3">
        {liquidityPools.map((p) => {
          const Token = tokenIcon[p.asset];
          const expanded = active === p.id;
          return (
            <div key={p.id} className="overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
              <div className="grid items-center gap-3 p-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <div className="flex items-center gap-3">
                  <Token className="h-10 w-10" />
                  <div>
                    <p className="text-[14px] font-bold text-white">{p.name}</p>
                    <p className="mono text-[11px] text-[var(--color-ink-3)]">
                      {p.asset} · vault.sportystake.{p.id}
                    </p>
                  </div>
                </div>
                <PoolMetric label="APY" value={`${p.apy}%`} accent="var(--color-brand-500)" />
                <PoolMetric label="TVL" value={formatUsd(p.tvl)} />
                <PoolMetric label="24h volume" value={formatUsd(p.volume24h)} />
                <div className="flex items-center gap-2 md:justify-end">
                  <UtilizationBar value={p.utilization} />
                  <Button
                    size="sm"
                    variant={expanded ? "danger" : "primary"}
                    onClick={() => setActive(expanded ? null : p.id)}
                  >
                    {expanded ? "Cancel" : p.myStake > 0 ? "Add more" : "Deposit"}
                  </Button>
                </div>
              </div>
              {expanded && (
                <div className="border-t border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-5">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
                        Deposit amount
                      </p>
                      <div className="flex h-11 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 focus-within:border-[var(--color-brand-500)]/40">
                        <Token className="h-5 w-5" />
                        <input
                          value={stake}
                          onChange={(e) => setStake(e.target.value)}
                          type="number"
                          inputMode="decimal"
                          placeholder="0.00"
                          className="mono ml-2 w-full bg-transparent text-[15px] font-bold text-white outline-none placeholder:text-[var(--color-ink-4)]"
                        />
                        <span className="text-[11px] font-bold text-[var(--color-ink-3)]">{p.asset}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {["25%", "50%", "Max"].map((v) => (
                        <button
                          key={v}
                          className="h-9 rounded-md bg-[var(--color-bg-2)] px-3 text-[11px] font-bold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-3)]"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <Button>Deposit {stake ? `${stake} ${p.asset}` : ""}</Button>
                  </div>
                  {stake && parseFloat(stake) > 0 && (
                    <div className="mt-3 grid gap-2 rounded-md bg-[var(--color-bg-2)] p-3 text-[12px] md:grid-cols-3">
                      <Row label="Daily" value={`+$${((parseFloat(stake) * p.apy) / 100 / 365).toFixed(2)}`} />
                      <Row label="Monthly" value={`+$${((parseFloat(stake) * p.apy) / 100 / 12).toFixed(2)}`} />
                      <Row label="Yearly" value={`+$${((parseFloat(stake) * p.apy) / 100).toFixed(2)}`} accent />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Explainer */}
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <Pillar Icon={ShieldIcon} title="Non-custodial" sub="Funds live inside audited ERC-4626 vault contracts. No platform balance sheet." />
        <Pillar Icon={TrendUp} title="Real yield" sub="Earnings denominated in margin from actual gameplay — not subsidized rewards." />
        <Pillar Icon={ZapIcon} title="Instant exits" sub="Withdraw whenever the vault has free capacity. No lock-ups, no slashing." />
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3">
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</p>
      <p className="mono mt-1 text-xl font-black" style={{ color: accent }}>{value}</p>
    </div>
  );
}

function Position({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</p>
      <p className="mono text-2xl font-black text-white" style={accent ? { color: accent } : undefined}>{value}</p>
      <p className="text-[11px] text-[var(--color-ink-3)]">{sub}</p>
    </div>
  );
}

function PoolMetric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</p>
      <p className="mono text-[16px] font-black text-white" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
    </div>
  );
}

function UtilizationBar({ value }: { value: number }) {
  return (
    <div className="hidden flex-col items-end gap-1 md:flex">
      <span className="mono text-[10px] text-[var(--color-ink-3)]">Util {Math.round(value * 100)}%</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-bg-3)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${value * 100}%`,
            background: value > 0.75 ? "var(--color-warn)" : "var(--color-brand-500)",
          }}
        />
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-ink-3)]">{label}</span>
      <span className={`mono font-bold ${accent ? "text-[var(--color-brand-500)]" : "text-white"}`}>{value}</span>
    </div>
  );
}

function Pillar({
  Icon,
  title,
  sub,
}: {
  Icon: (p: { className?: string }) => React.ReactElement;
  title: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-bg-3)] text-[var(--color-brand-500)]">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[14px] font-bold text-white">{title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-ink-3)]">{sub}</p>
    </div>
  );
}
