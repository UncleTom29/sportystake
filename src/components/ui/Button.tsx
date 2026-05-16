import { ReactNode, ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "odds";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

const variants = {
  primary: "bg-green-500 hover:bg-green-400 text-black font-bold",
  secondary: "bg-[#1e3a5f] hover:bg-[#274d80] text-white font-semibold",
  ghost: "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white",
  danger: "bg-red-600 hover:bg-red-500 text-white font-semibold",
  odds: "bg-[#1a2f47] hover:bg-[#1e88e5] text-white font-semibold border border-[#243447] hover:border-[#1e88e5] transition-all",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-xl",
  lg: "px-6 py-3 text-base rounded-xl",
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
      className={`inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
