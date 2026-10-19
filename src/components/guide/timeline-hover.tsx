"use client";

import { useRef, useState } from "react";

type Tip = { x: number; y: number; flip: boolean; title: string; kind: string; time: string; tone: string };

const toneClass: Record<string, string> = {
  agent: "text-brand",
  you: "text-ink",
  wait: "text-warn",
  blocker: "text-bad",
};

export function TimelineHover({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const show = (target: EventTarget | null, clientX?: number, clientY?: number) => {
    const el = target instanceof Element ? target.closest<SVGElement | HTMLElement>("[data-tip-title]") : null;
    const box = ref.current?.getBoundingClientRect();
    if (!el || !box) return setTip(null);
    const r = el.getBoundingClientRect();
    const x = (clientX ?? r.left + r.width / 2) - box.left;
    const y = (clientY ?? r.top) - box.top;
    setTip({
      x: Math.min(Math.max(x, 8), box.width - 8),
      y,
      flip: x > box.width - 280,
      title: el.dataset.tipTitle ?? "",
      kind: el.dataset.tipKind ?? "",
      time: el.dataset.tipTime ?? "",
      tone: el.dataset.tipTone ?? "you",
    });
  };

  return (
    <div
      ref={ref}
      className="relative"
      onPointerMove={(e) => show(e.target, e.clientX, e.clientY)}
      onPointerLeave={() => setTip(null)}
      onFocus={(e) => show(e.target)}
      onBlur={() => setTip(null)}
    >
      {children}
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-30 w-64 border border-ink bg-white p-3 text-left"
          style={{
            left: tip.x,
            top: tip.y,
            transform: `translate(${tip.flip ? "calc(-100% - 12px)" : "12px"}, calc(-100% - 12px))`,
          }}
        >
          <p className={`label ${toneClass[tip.tone] ?? "text-ink"}`}>{tip.kind}</p>
          <p className="mt-1 text-[14px] leading-snug text-ink">{tip.title}</p>
          {tip.time && <p className="mt-1.5 font-mono text-[12px] text-ink/55">{tip.time}</p>}
        </div>
      )}
    </div>
  );
}
