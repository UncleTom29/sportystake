"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldIcon, BadgeCheck, ZapIcon, ArrowUpRight } from "@/components/icons/UIIcons";
import Badge from "@/components/ui/Badge";

const TERMS_STORAGE_KEY = "sportystake_terms_accepted_v1";

export default function ComplianceModal() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Checkboxes
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [decentralizedConfirmed, setDecentralizedConfirmed] = useState(false);
  const [termsConfirmed, setTermsConfirmed] = useState(false);

  useEffect(() => {
    setMounted(true);
    const accepted = localStorage.getItem(TERMS_STORAGE_KEY);
    if (!accepted) {
      setIsOpen(true);
      document.body.style.overflow = "hidden";
    }
  }, []);

  const handleAccept = () => {
    if (!ageConfirmed || !decentralizedConfirmed || !termsConfirmed) return;
    localStorage.setItem(TERMS_STORAGE_KEY, "true");
    document.body.style.overflow = "auto";
    setIsOpen(false);
  };

  if (!mounted || !isOpen) return null;

  const allChecked = ageConfirmed && decentralizedConfirmed && termsConfirmed;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl transition-all">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--color-brand-500)]/40 bg-[var(--color-bg-2)] p-6 md:p-8 shadow-[0_0_50px_rgba(0,231,1,0.15)] animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-mesh absolute inset-0 opacity-40 pointer-events-none" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-line-1)] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
                <ShieldIcon className="h-5 w-5" />
              </div>
              <div>
                <Badge variant="brand">Protocol Compliance</Badge>
                <h2 className="text-xl font-black text-white mt-0.5">Welcome to SportyStake</h2>
              </div>
            </div>
            <span className="mono text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              18+ ONLY
            </span>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
            Before accessing the platform, you must review and confirm compliance with our decentralized protocol terms & legal age requirements.
          </p>

          {/* Key Bulletins */}
          <div className="mt-4 space-y-2.5 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4 text-[12px]">
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none">🔞</span>
              <div>
                <strong className="text-white">Age Requirement:</strong> You must be at least 18 years of age (or legal gambling age in your jurisdiction).
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none">⛓️</span>
              <div>
                <strong className="text-white">100% Non-Custodial Protocol:</strong> SportyStake operates via self-custodial EVM smart contracts. You retain sole ownership of your Web3 keys & funds.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none">⚖️</span>
              <div>
                <strong className="text-white">Jurisdictional Liability:</strong> Accessing decentralized wagering and liquidity pools must comply with your local laws. You assume full legal responsibility.
              </div>
            </div>
          </div>

          {/* Interactive Checkboxes */}
          <div className="mt-5 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--color-line-2)] bg-[var(--color-bg-1)] text-[var(--color-brand-500)] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[var(--color-brand-500)]"
              />
              <span className="text-[12px] font-medium text-[var(--color-ink-2)] group-hover:text-white transition-colors">
                I confirm that I am <strong className="text-white">at least 18 years of age</strong> (or legal age in my country).
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={decentralizedConfirmed}
                onChange={(e) => setDecentralizedConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--color-line-2)] bg-[var(--color-bg-1)] text-[var(--color-brand-500)] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[var(--color-brand-500)]"
              />
              <span className="text-[12px] font-medium text-[var(--color-ink-2)] group-hover:text-white transition-colors">
                I understand SportyStake is a <strong className="text-white">decentralized protocol</strong> and I am fully liable for its usage in my jurisdiction.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={termsConfirmed}
                onChange={(e) => setTermsConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--color-line-2)] bg-[var(--color-bg-1)] text-[var(--color-brand-500)] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[var(--color-brand-500)]"
              />
              <span className="text-[12px] font-medium text-[var(--color-ink-2)] group-hover:text-white transition-colors">
                I have read and agree to the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="font-bold text-[var(--color-brand-500)] underline hover:text-[var(--color-brand-400)]"
                >
                  Terms & Conditions
                </Link>{" "}
                and Risk Disclosures.
              </span>
            </label>
          </div>

          {/* Action Button */}
          <div className="mt-6 pt-4 border-t border-[var(--color-line-1)] flex flex-col gap-2">
            <button
              onClick={handleAccept}
              disabled={!allChecked}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--color-brand-500)] text-black hover:bg-[var(--color-brand-400)] active:scale-[0.98]"
            >
              <BadgeCheck className="h-4 w-4" />
              Confirm
            </button>
            <p className="text-[10px] text-center text-[var(--color-ink-4)] font-medium">
              By entering, you confirm agreement to smart contract protocol terms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
