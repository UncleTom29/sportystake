import { ReactNode, ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--color-brand-500)] hover:bg-[var(--color-brand-400)] text-[var(--color-bg-0)] font-bold",
  secondary:
    "bg-[var(--color-bg-3)] hover:bg-[var(--color-bg-4)] text-white font-semibold",
  ghost:
    "bg-transparent hover:bg-[var(--color-bg-2)] text-[var(--color-ink-2)] hover:text-white",
  danger: "bg-[var(--color-live)] hover:opacity-90 text-white font-semibold",
  outline:
    "border border-[var(--color-line-2)] bg-transparent hover:bg-[var(--color-bg-2)] text-white font-semibold",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-2.5 text-[12px] rounded-md",
  md: "h-10 px-3.5 text-[13px] rounded-md",
  lg: "h-11 px-5 text-[14px] rounded-md",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
