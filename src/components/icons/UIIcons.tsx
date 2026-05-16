import type { SVGProps } from "react";
type Props = SVGProps<SVGSVGElement>;

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function LogoMark(props: Props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0" stopColor="#00E701" />
          <stop offset="1" stopColor="#00A302" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#logoGrad)" />
      <path d="M13 24.5c0 2 2 3.5 5 3.5s5-1.4 5-3.2c0-4-9-3-9-7 0-1.6 1.8-2.8 4.4-2.8 2.4 0 4.1 1 4.6 2.6"
        stroke="#0b141b" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <circle cx="29" cy="13" r="2" fill="#0b141b" />
    </svg>
  );
}

export function SearchIcon(props: Props) {
  return <svg {...base} {...props}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>;
}

export function BellIcon(props: Props) {
  return <svg {...base} {...props}><path d="M6 16V11a6 6 0 1112 0v5l1.5 2H4.5L6 16z" /><path d="M10 21a2 2 0 004 0" /></svg>;
}

export function WalletIcon(props: Props) {
  return <svg {...base} {...props}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1" fill="currentColor" /></svg>;
}

export function ChevronDown(props: Props) {
  return <svg {...base} {...props}><path d="M6 9l6 6 6-6" /></svg>;
}
export function ChevronUp(props: Props) {
  return <svg {...base} {...props}><path d="M6 15l6-6 6 6" /></svg>;
}
export function ChevronRight(props: Props) {
  return <svg {...base} {...props}><path d="M9 6l6 6-6 6" /></svg>;
}
export function ChevronLeft(props: Props) {
  return <svg {...base} {...props}><path d="M15 6l-6 6 6 6" /></svg>;
}

export function CloseIcon(props: Props) {
  return <svg {...base} {...props}><path d="M6 6l12 12M18 6L6 18" /></svg>;
}
export function PlusIcon(props: Props) {
  return <svg {...base} {...props}><path d="M12 5v14M5 12h14" /></svg>;
}
export function MinusIcon(props: Props) {
  return <svg {...base} {...props}><path d="M5 12h14" /></svg>;
}
export function StarIcon(props: Props) {
  return <svg {...base} {...props}><path d="M12 3l2.6 6 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.2L7.8 14 3 9.6 9.4 9z" /></svg>;
}

export function FlameIcon(props: Props) {
  return <svg {...base} {...props}><path d="M12 3c1.5 3.5-1 5 1 7.5C16 14 14 18 12 21c-3 0-7-2-7-7 0-3 2-4 3-6 1 1 2 1 2-2 0-1 1-2 2-3z" /></svg>;
}

export function TrophyIcon(props: Props) {
  return <svg {...base} {...props}><path d="M7 4h10v4a5 5 0 01-10 0V4z" /><path d="M5 5H3v2a3 3 0 003 3M19 5h2v2a3 3 0 01-3 3" /><path d="M9 13v2l-2 4h10l-2-4v-2" /></svg>;
}

export function CasinoChipIcon(props: Props) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>;
}

export function ZapIcon(props: Props) {
  return <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" /></svg>;
}

export function BadgeCheck(props: Props) {
  return <svg {...base} {...props}><path d="M9 12l2 2 4-4" /><path d="M12 3l2.4 1.8L17 4l1.2 2.4L21 8l-.8 2.8L21 14l-2.6 1.4L17 18l-2.8-.4L12 21l-2.2-3.4L7 18l-1.4-2.6L3 14l1-2.8L3 8l2.6-1.6L7 4l3 .8L12 3z" /></svg>;
}

export function HeartIcon(props: Props) {
  return <svg {...base} {...props}><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.7A4 4 0 0119 10c0 5.5-7 10-7 10z" /></svg>;
}

export function ArrowUpRight(props: Props) {
  return <svg {...base} {...props}><path d="M7 17L17 7M9 7h8v8" /></svg>;
}

export function MenuIcon(props: Props) {
  return <svg {...base} {...props}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
}

export function HomeIcon(props: Props) {
  return <svg {...base} {...props}><path d="M4 11l8-7 8 7v9a2 2 0 01-2 2h-3v-6h-6v6H6a2 2 0 01-2-2v-9z" /></svg>;
}

export function LiveIcon(props: Props) {
  return <svg viewBox="0 0 24 24" fill="currentColor" {...props}><circle cx="12" cy="12" r="4" /><path d="M6 6a8 8 0 000 12M18 6a8 8 0 010 12M3 3a13 13 0 000 18M21 3a13 13 0 010 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

export function TicketIcon(props: Props) {
  return <svg {...base} {...props}><path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4V8z" /><path d="M15 6v12" strokeDasharray="2 3" /></svg>;
}

export function GiftIcon(props: Props) {
  return <svg {...base} {...props}><rect x="3" y="9" width="18" height="11" rx="1" /><path d="M3 13h18M12 9v11M8 9a3 3 0 010-6c2 0 4 3 4 6-3 0-6-2-6-4M16 9a3 3 0 000-6c-2 0-4 3-4 6 3 0 6-2 6-4" /></svg>;
}

export function ShieldIcon(props: Props) {
  return <svg {...base} {...props}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>;
}

export function CopyIcon(props: Props) {
  return <svg {...base} {...props}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3" /></svg>;
}

export function TrendUp(props: Props) {
  return <svg {...base} {...props}><path d="M3 17l6-6 4 4 8-9" /><path d="M14 6h7v7" /></svg>;
}
export function TrendDown(props: Props) {
  return <svg {...base} {...props}><path d="M3 7l6 6 4-4 8 9" /><path d="M14 18h7v-7" /></svg>;
}

export function SparkleIcon(props: Props) {
  return <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z" /><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></svg>;
}

export function UsdtIcon(props: Props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="11" fill="#26A17B" />
      <path d="M13.3 11.1V9.4h3.9V6.9H6.8v2.5h3.9v1.7c-3.2.1-5.6.8-5.6 1.6 0 .8 2.4 1.5 5.6 1.6v5.3h2.6v-5.3c3.1-.1 5.5-.8 5.5-1.6 0-.8-2.4-1.5-5.5-1.6zm0 2.7v-.1c-.2 0-1 .1-2.1.1-.9 0-1.7-.1-2-.1.1 0 0 0 0 0v.1c-2.6-.1-4.5-.5-4.5-1s2-.9 4.5-1v1.7c.3 0 1.1.1 2 .1 1.1 0 1.9-.1 2.1-.1V12.8c2.6.1 4.5.5 4.5 1s-1.9.9-4.5 1z" fill="#fff" />
    </svg>
  );
}

export function UsdcIcon(props: Props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="11" fill="#2775CA" />
      <path d="M12 4.5C7.86 4.5 4.5 7.86 4.5 12s3.36 7.5 7.5 7.5 7.5-3.36 7.5-7.5S16.14 4.5 12 4.5zM9.7 16.4c-1.7-.6-2.9-2.2-2.9-4 0-1.9 1.2-3.4 2.9-4 .2-.1.3-.2.3-.4v-.6c0-.2-.2-.4-.4-.3-2.4.7-4.1 2.8-4.1 5.3s1.7 4.6 4.1 5.3c.2.1.4-.1.4-.3v-.6c0-.2-.1-.4-.3-.4zm5-9.4v-.6c0-.2.2-.4.4-.3 2.4.7 4.1 2.8 4.1 5.3s-1.7 4.6-4.1 5.3c-.2.1-.4-.1-.4-.3v-.6c0-.2.1-.4.3-.4 1.7-.6 2.9-2.2 2.9-4s-1.2-3.4-2.9-4c-.2-.1-.3-.2-.3-.4zM12.6 11.4c1.4.3 2.1.7 2.1 1.7 0 .7-.5 1.3-1.5 1.5v.5c0 .3-.2.5-.5.5h-.5c-.3 0-.5-.2-.5-.5v-.5c-.9-.1-1.6-.7-1.7-1.4 0-.2.1-.4.3-.4h.5c.2 0 .4.1.5.3.1.4.4.6 1 .6.6 0 1-.2 1-.5s-.2-.4-1.2-.6c-1.3-.3-2-.7-2-1.7 0-.7.5-1.3 1.4-1.5V9c0-.3.2-.5.5-.5h.5c.3 0 .5.2.5.5v.4c.8.1 1.4.6 1.6 1.3.1.2-.1.4-.3.4h-.5c-.2 0-.4-.1-.5-.3-.1-.3-.4-.5-.9-.5-.5 0-.9.2-.9.5s.2.4 1.1.6z" fill="#fff" />
    </svg>
  );
}

export function EthIcon(props: Props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="11" fill="#627EEA" />
      <path d="M12 4v6l5 2.2L12 4z" fill="#fff" fillOpacity=".6" />
      <path d="M12 4L7 12.2 12 10V4z" fill="#fff" />
      <path d="M12 16.5v3.5L17 13l-5 3.5z" fill="#fff" fillOpacity=".6" />
      <path d="M12 20v-3.5L7 13l5 7z" fill="#fff" />
      <path d="M12 15.5l5-3.3-5-2.2v5.5z" fill="#fff" fillOpacity=".2" />
      <path d="M7 12.2l5 3.3V10z" fill="#fff" fillOpacity=".6" />
    </svg>
  );
}
