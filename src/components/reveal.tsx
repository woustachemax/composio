"use client";

import { useEffect, useRef } from "react";

export function Reveal({ children, className = "", wipe = "x" }: { children: React.ReactNode; className?: string; wipe?: "x" | "y" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return;
    el.dataset.reveal = "armed";
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        el.dataset.reveal = "play";
        io.disconnect();
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      <div className={wipe === "x" ? "anim-wipe-x" : "anim-wipe-y"}>{children}</div>
    </div>
  );
}
