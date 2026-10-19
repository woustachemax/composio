import Link from "next/link";
import { difficultyLabel, type GuideCard } from "@/lib/guide-view";
import { AppLogo } from "@/components/app-logo";
import { Meter } from "@/components/ui";
import { ArrowRight } from "lucide-react";

export const rowGrid = "grid grid-cols-[1fr_auto] items-center gap-x-4 md:grid-cols-[minmax(180px,1.3fr)_120px_120px_170px_110px_minmax(0,1.6fr)_24px]";

export function GuideRowHeader() {
  return (
    <div className={`${rowGrid} hidden border-b border-line px-4 py-2.5 font-mono text-[11px] text-ink/40 uppercase md:grid`}>
      <span>App</span>
      <span>Difficulty</span>
      <span>Hands-on</span>
      <span>Approval wait</span>
      <span>Managed</span>
      <span>Watch out for</span>
      <span />
    </div>
  );
}

export function GuideRow({ card, maxWeeks }: { card: GuideCard; maxWeeks: number }) {
  const waitPct = maxWeeks > 0 ? (card.waitWeeks / maxWeeks) * 100 : 0;
  return (
    <Link href={`/guides/${card.slug}`} className={`${rowGrid} group border-b border-line px-4 py-4 transition last:border-b-0 hover:bg-paper`}>
      <span className="flex min-w-0 items-center gap-3">
        <AppLogo src={card.logo} name={card.name} size={32} />
        <span className="min-w-0">
          <span className="block truncate text-[16px] tracking-[-0.01em] text-ink">{card.name}</span>
          <span className="block truncate font-mono text-[11px] text-ink/40 uppercase">
            {card.category}
            {card.origin === "agent-generated" && " · agent"}
          </span>
        </span>
      </span>

      <span className="hidden items-center gap-2 md:flex">
        <Meter level={card.difficulty} />
        <span className="text-[14px]">{difficultyLabel[card.difficulty]}</span>
      </span>
      <span className="hidden font-mono text-[13px] text-ink md:block">{card.handsOn}</span>
      <span className="hidden md:block">
        <span className={`font-mono text-[13px] ${card.waitWeeks ? "text-warn" : "text-ok"}`}>{card.wait}</span>
        <span className="mt-1.5 block h-1 w-full bg-ink/[0.06]">
          {waitPct > 0 && <span className="block h-full bg-warn" style={{ width: `${waitPct}%` }} />}
        </span>
      </span>
      <span className={`hidden font-mono text-[13px] md:block ${card.managed === "yes" ? "text-ok" : card.managed === "no" ? "text-bad" : "text-ink/40"}`}>
        {card.managed === "yes" ? "Yes" : card.managed === "no" ? "No" : "Unknown"}
      </span>
      <span className="hidden truncate text-[14px] text-ink/60 md:block">{card.flags[0] ?? ""}</span>
      <ArrowRight aria-hidden className="h-4 w-4 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-ink" strokeWidth={1.75} />

      <span className="col-span-2 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] md:hidden">
        <span className="flex items-center gap-1.5">
          <Meter level={card.difficulty} />
          {difficultyLabel[card.difficulty]}
        </span>
        <span className="text-ink/60">{card.handsOn}</span>
        <span className={card.waitWeeks ? "text-warn" : "text-ok"}>{card.waitWeeks ? `${card.wait} wait` : "No wait"}</span>
        {card.managed === "no" && <span className="text-bad">No managed app</span>}
      </span>
    </Link>
  );
}
