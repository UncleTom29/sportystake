import { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "green" | "red" | "blue" | "yellow" | "gray";
  size?: "sm" | "md";
};

const variants = {
  green: "bg-green-500/20 text-green-400 border border-green-500/30",
  red: "bg-red-500/20 text-red-400 border border-red-500/30",
  blue: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  yellow: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  gray: "bg-white/10 text-gray-400 border border-white/10",
};

export default function Badge({ children, variant = "gray", size = "sm" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variants[variant]} ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}`}
    >
      {children}
    </span>
  );
}
