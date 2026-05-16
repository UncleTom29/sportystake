import { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "brand" | "live" | "info" | "warn" | "neutral" | "violet";
  size?: "sm" | "md";
  pill?: boolean;
};

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  brand: "bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)] border border-[var(--color-brand-500)]/25",
  live: "bg-[var(--color-live)]/15 text-[var(--color-live)] border border-[var(--color-live)]/25",
  info: "bg-[var(--color-info)]/15 text-[var(--color-info)] border border-[var(--color-info)]/25",
  warn: "bg-[var(--color-warn)]/15 text-[var(--color-warn)] border border-[var(--color-warn)]/25",
  neutral: "bg-[var(--color-bg-3)] text-[var(--color-ink-1)] border border-[var(--color-line-2)]",
  violet: "bg-violet-500/15 text-violet-300 border border-violet-500/25",
};

export default function Badge({ children, variant = "neutral", size = "sm", pill }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider ${variants[variant]} ${
        pill ? "rounded-full" : "rounded-md"
      } ${size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]"}`}
    >
      {children}
    </span>
  );
}
