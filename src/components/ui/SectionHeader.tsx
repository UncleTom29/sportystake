import Link from "next/link";
import { ChevronRight } from "@/components/icons/UIIcons";

export default function SectionHeader({
  title,
  subtitle,
  href,
  cta = "View all",
  right,
  Icon,
  accent,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  cta?: string;
  right?: React.ReactNode;
  Icon?: (p: { className?: string }) => React.ReactElement;
  accent?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{ background: `${accent ?? "#00e701"}1f`, color: accent ?? "#00e701" }}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div>
          <h2 className="text-[16px] font-black tracking-tight text-white md:text-[18px]">{title}</h2>
          {subtitle && <p className="text-[12px] text-[var(--color-ink-3)]">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {right}
        {href && (
          <Link href={href} className="flex items-center gap-0.5 text-[12px] font-semibold text-[var(--color-ink-2)] hover:text-white">
            {cta}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
