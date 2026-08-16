/**
 * Lightweight i18n scaffold.
 *
 * Wagering apps usually grow into next-intl or similar once they have more
 * than two locales, but we don't need that complexity yet — every string
 * runs through `t()` and the dictionary is a plain object so it stays
 * tree-shakeable.
 *
 * Usage:
 *   import { t } from "@/lib/i18n";
 *   t("bet.confirm");
 *
 * Server components can call `t()` directly. Client components that want
 * reactive locale switching should use the `useI18n` hook below.
 */
"use client";

import { create } from "zustand";

export type Locale = "en" | "es";

type Dict = Record<string, string>;

const EN: Dict = {
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.connect": "Connect wallet",
  "common.disconnect": "Disconnect",
  "common.signIn": "Sign in",
  "common.loading": "Loading…",
  "common.error": "Something went wrong",
  "bet.place": "Place bet",
  "bet.confirm": "Confirm bet",
  "bet.success": "Bet placed!",
  "bet.live": "Live",
  "bet.totalStake": "Total stake",
  "bet.potentialPayout": "Potential payout",
  "casino.crash": "Crash",
  "casino.dice": "Dice",
  "casino.slots": "Slots",
  "casino.win": "You won!",
  "casino.lose": "Better luck next time",
  "pools.deposit": "Deposit USDC",
  "pools.withdraw": "Withdraw",
  "pools.apy": "APY",
  "pools.tvl": "TVL",
  "auth.signInPrompt": "Sign in to SportyStake",
  "auth.signInBody": "Sign a message with your wallet to prove ownership. No gas.",
};

const ES: Dict = {
  "common.cancel": "Cancelar",
  "common.confirm": "Confirmar",
  "common.connect": "Conectar billetera",
  "common.disconnect": "Desconectar",
  "common.signIn": "Iniciar sesión",
  "common.loading": "Cargando…",
  "common.error": "Algo salió mal",
  "bet.place": "Realizar apuesta",
  "bet.confirm": "Confirmar apuesta",
  "bet.success": "¡Apuesta realizada!",
  "bet.live": "En vivo",
  "bet.totalStake": "Apuesta total",
  "bet.potentialPayout": "Pago potencial",
  "casino.crash": "Crash",
  "casino.dice": "Dados",
  "casino.slots": "Tragamonedas",
  "casino.win": "¡Ganaste!",
  "casino.lose": "Mejor suerte la próxima",
  "pools.deposit": "Depositar USDC",
  "pools.withdraw": "Retirar",
  "pools.apy": "APY",
  "pools.tvl": "TVL",
  "auth.signInPrompt": "Iniciar sesión en SportyStake",
  "auth.signInBody": "Firma un mensaje con tu billetera para verificar tu identidad. Sin gas.",
};

const DICTS: Record<Locale, Dict> = { en: EN, es: ES };

interface I18nState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useI18n = create<I18nState>((set) => ({
  locale: typeof window !== "undefined"
    ? ((localStorage.getItem("ss_locale") as Locale | null) ?? "en")
    : "en",
  setLocale: (l) => {
    if (typeof window !== "undefined") localStorage.setItem("ss_locale", l);
    set({ locale: l });
  },
}));

/**
 * Resolve a translation key for the current locale. Falls back to the key
 * itself if missing so the UI never shows `undefined`.
 *
 * Pass a `vars` object to interpolate `{name}` placeholders.
 */
export function t(key: string, vars?: Record<string, string | number>, locale?: Locale): string {
  const l = locale ?? (typeof window !== "undefined" ? (useI18n.getState().locale) : "en");
  const raw = DICTS[l]?.[key] ?? DICTS.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export const SUPPORTED_LOCALES: Locale[] = ["en", "es"];
