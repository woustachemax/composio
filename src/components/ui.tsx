export function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`label text-ink/50 ${className}`}>{children}</p>;
}

export function SectionHead({
  n,
  id,
  label,
  title,
  aside,
  dark = false,
}: {
  n: string;
  id?: string;
  label: string;
  title: React.ReactNode;
  aside?: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div id={id} className="scroll-mt-20">
      <div className="flex items-center gap-3">
        <span className={`num border ${dark ? "border-line-dark text-white/70" : "border-line bg-white text-ink/70"}`}>{n}</span>
        <span className={`label ${dark ? "text-white/50" : "text-ink/50"}`}>{label}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className={`text-[28px] leading-[1.1] tracking-[-0.025em] sm:text-[34px] ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
        {aside}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, className = "" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={`p-4 sm:p-5 ${className}`}>
      <p className="label text-ink/50">{label}</p>
      <div className="mt-2 text-[26px] leading-none tracking-[-0.025em] text-ink">{value}</div>
      {sub && <div className="mt-2 text-[13px] leading-snug text-ink/60">{sub}</div>}
    </div>
  );
}

export function Meter({ level }: { level: "easy" | "moderate" | "hard" }) {
  const filled = level === "easy" ? 1 : level === "moderate" ? 2 : 3;
  const color = level === "easy" ? "bg-ok" : level === "moderate" ? "bg-warn" : "bg-bad";
  return (
    <span className="inline-flex gap-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-2.5 w-1.5 ${i < filled ? color : "bg-ink/10"}`} />
      ))}
    </span>
  );
}
